const express = require("express");
const { getDB } = require("../config/db");
const authMiddleware = require("../middleware/auth");
const { aiRateLimiter, sandboxRateLimiter } = require("../middleware/rateLimiter");
const { runCode } = require("../services/dockerRunner.service");
const { generateJSON } = require("../services/llm.service");
const { getCachedAIResponse, setCachedAIResponse } = require("../services/cache.service");
const {
  QuizSubmitSchema,
  ExerciseSubmitSchema,
  ExerciseErrorFeedbackSchema,
  ExerciseSuccessFollowUpSchema
} = require("../schemas/test.schema");
const { recordQuizCompleted, recordExercisePassed } = require("../services/progress.service");

const router = express.Router();

// GET /api/tests/quizzes/:slug - Get quiz questions with answer keys withheld
router.get("/quizzes/:slug", authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const quiz = await db.collection("quizzes").findOne({ techSlug: req.params.slug });
    if (!quiz) {
      return res.status(404).json({ error: `No quiz found for technology: ${req.params.slug}` });
    }

    // Strip answer keys and explanations
    const clientQuestions = quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options
    }));

    return res.status(200).json({
      techSlug: quiz.techSlug,
      title: quiz.title,
      questions: clientQuestions
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch quiz." });
  }
});

// POST /api/tests/quizzes/:slug/submit - Deterministic evaluation against stored keys
router.post("/quizzes/:slug/submit", authMiddleware, async (req, res) => {
  try {
    const parseRes = QuizSubmitSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({ error: "Invalid quiz submission payload", details: parseRes.error.errors });
    }

    const { answers } = parseRes.data;
    const db = getDB();
    const quiz = await db.collection("quizzes").findOne({ techSlug: req.params.slug });
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    let correctCount = 0;
    const results = quiz.questions.map((q) => {
      const selectedIndex = answers[q.id];
      const isCorrect = selectedIndex !== undefined && selectedIndex === q.correctAnswerIndex;
      if (isCorrect) correctCount++;

      return {
        questionId: q.id,
        isCorrect,
        selectedAnswerIndex: selectedIndex ?? null,
        correctAnswerIndex: q.correctAnswerIndex,
        explanation: q.explanation
      };
    });

    const score = Math.round((correctCount / quiz.questions.length) * 100);
    await recordQuizCompleted(db, req.user.userId, quiz.techSlug, score);

    return res.status(200).json({
      techSlug: quiz.techSlug,
      title: quiz.title,
      totalQuestions: quiz.questions.length,
      correctCount,
      score,
      passed: score >= 70,
      results
    });
  } catch (err) {
    console.error("[TESTS] Failed to grade quiz or record progress:", err.message);
    return res.status(500).json({ error: "Failed to grade quiz submission." });
  }
});

// GET /api/tests/exercises - List all available coding exercises
router.get("/exercises", authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const exercises = await db.collection("code_exercises").find({}, {
      projection: {
        slug: 1,
        techSlug: 1,
        title: 1,
        description: 1,
        difficulty: 1
      }
    }).toArray();

    return res.status(200).json({ exercises });
  } catch (err) {
    return res.status(500).json({ error: "Failed to list coding exercises." });
  }
});

// GET /api/tests/exercises/:slug - Get coding exercise with hidden test cases withheld
router.get("/exercises/:slug", authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const exercise = await db.collection("code_exercises").findOne({ slug: req.params.slug });
    if (!exercise) {
      return res.status(404).json({ error: "Coding exercise not found" });
    }

    // Expose only public test cases
    const publicTestCases = (exercise.testCases || [])
      .filter((tc) => !tc.isHidden)
      .map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput
      }));

    return res.status(200).json({
      slug: exercise.slug,
      techSlug: exercise.techSlug,
      title: exercise.title,
      description: exercise.description,
      difficulty: exercise.difficulty,
      starterCode: exercise.starterCode,
      publicTestCases
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch exercise." });
  }
});

// POST /api/tests/exercises/:slug/run - Run code against visible public test cases
router.post("/exercises/:slug/run", authMiddleware, sandboxRateLimiter, async (req, res) => {
  try {
    const parseRes = ExerciseSubmitSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({ error: "Invalid code submission", details: parseRes.error.errors });
    }

    const db = getDB();
    const exercise = await db.collection("code_exercises").findOne({ slug: req.params.slug });
    if (!exercise) {
      return res.status(404).json({ error: "Coding exercise not found" });
    }

    const publicCases = (exercise.testCases || []).filter((tc) => !tc.isHidden);
    const testResults = [];

    for (let i = 0; i < publicCases.length; i++) {
      const tc = publicCases[i];
      const runRes = await runCode({
        language: exercise.techSlug,
        code: parseRes.data.code,
        stdin: tc.input,
        timeLimitMs: 4000
      });

      const actualTrimmed = (runRes.stdout || "").trim();
      const expectedTrimmed = String(tc.expectedOutput).trim();
      const passed = runRes.status === "accepted" && actualTrimmed === expectedTrimmed;

      testResults.push({
        testCaseIndex: i + 1,
        input: tc.input,
        expectedOutput: expectedTrimmed,
        actualOutput: actualTrimmed,
        passed,
        status: runRes.status,
        stderr: runRes.stderr || "",
        timeMs: runRes.timeMs
      });
    }

    return res.status(200).json({
      slug: exercise.slug,
      testResults,
      allPassed: testResults.every((t) => t.passed)
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to run public test cases." });
  }
});

// POST /api/tests/exercises/:slug/submit - Official deterministic grading against all (public + hidden) test cases
router.post("/exercises/:slug/submit", authMiddleware, sandboxRateLimiter, async (req, res) => {
  try {
    const parseRes = ExerciseSubmitSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({ error: "Invalid code submission", details: parseRes.error.errors });
    }

    const db = getDB();
    const exercise = await db.collection("code_exercises").findOne({ slug: req.params.slug });
    if (!exercise) {
      return res.status(404).json({ error: "Coding exercise not found" });
    }

    const allTestCases = exercise.testCases || [];
    let passedCount = 0;
    const testResults = [];
    let firstFailedCase = null;

    for (let i = 0; i < allTestCases.length; i++) {
      const tc = allTestCases[i];
      const runRes = await runCode({
        language: exercise.techSlug,
        code: parseRes.data.code,
        stdin: tc.input,
        timeLimitMs: 5000
      });

      const actualTrimmed = (runRes.stdout || "").trim();
      const expectedTrimmed = String(tc.expectedOutput).trim();
      const passed = runRes.status === "accepted" && actualTrimmed === expectedTrimmed;

      if (passed) {
        passedCount++;
      } else if (!firstFailedCase) {
        firstFailedCase = {
          testCaseIndex: i + 1,
          isHidden: tc.isHidden,
          input: tc.isHidden ? "[Hidden Test Case]" : tc.input,
          expectedOutput: tc.isHidden ? "[Hidden]" : expectedTrimmed,
          actualOutput: actualTrimmed,
          status: runRes.status,
          stderr: runRes.stderr
        };
      }

      testResults.push({
        testCaseIndex: i + 1,
        isHidden: tc.isHidden,
        passed,
        status: runRes.status,
        actualOutput: tc.isHidden ? (passed ? "Passed" : "Mismatch") : actualTrimmed,
        expectedOutput: tc.isHidden ? "[Hidden]" : expectedTrimmed,
        stderr: tc.isHidden ? (runRes.stderr ? "Runtime error occurred" : "") : runRes.stderr
      });
    }

    const allPassed = passedCount === allTestCases.length;
    if (allPassed) {
      await recordExercisePassed(db, req.user.userId, exercise.techSlug, exercise.slug);
    }

    return res.status(200).json({
      slug: exercise.slug,
      allPassed,
      totalTests: allTestCases.length,
      passedCount,
      testResults,
      failedCase: firstFailedCase
    });
  } catch (err) {
    console.error("[TESTS] Failed to grade exercise or record progress:", err.message);
    return res.status(500).json({ error: "Failed to grade coding submission." });
  }
});

// POST /api/tests/exercises/:slug/feedback - Grounded AI reflective feedback (never grades, explains/reflects only)
router.post("/exercises/:slug/feedback", authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { code, passed, failedCase } = req.body;
    if (typeof code !== "string" || typeof passed !== "boolean") {
      return res.status(400).json({ error: "code and passed boolean flag are required" });
    }

    const db = getDB();
    const exercise = await db.collection("code_exercises").findOne({ slug: req.params.slug });
    if (!exercise) {
      return res.status(404).json({ error: "Coding exercise not found" });
    }

    const action = passed ? "exercise_reflection" : "exercise_failure_feedback";
    const cacheKeyInput = `${exercise.slug}:${code}:${passed}`;

    let prompt = "";
    let schema = null;

    if (!passed) {
      schema = ExerciseErrorFeedbackSchema;
      prompt = `You are an expert computer science tutor helping a student understand their programming mistake.
IMPORTANT RULES:
1. DO NOT give the final code solution. Give a conceptual hint.
2. The deterministic test runner already failed the code. You are explaining WHY it failed.
3. Ground your explanation strictly in the code and test failure.

EXERCISE: ${exercise.title} (${exercise.techSlug})
DESCRIPTION: ${exercise.description}

STUDENT SUBMISSION:
\`\`\`${exercise.techSlug}
${code}
\`\`\`

REFERENCE SOLUTION PATTERN (for your understanding only, do not leak directly):
\`\`\`${exercise.techSlug}
${exercise.referenceSolution}
\`\`\`

FAILURE DETAILS:
${failedCase ? JSON.stringify(failedCase, null, 2) : "Failed test case assertions"}

Return a strictly valid JSON object matching the schema:
{
  "failureAnalysis": "string explaining the failure",
  "conceptualMisunderstanding": "string explaining the misconception",
  "hintWithoutGivingAnswer": "string with constructive hint",
  "relevantDocsReference": ""
}`;
    } else {
      schema = ExerciseSuccessFollowUpSchema;
      prompt = `You are a computer science professor challenging a student who successfully solved an algorithmic problem.
The student passed all public and hidden test cases. Now, help them reflect on their architecture and design choices.

EXERCISE: ${exercise.title} (${exercise.techSlug})
DESCRIPTION: ${exercise.description}
PEDAGOGICAL FOLLOW-UP PROMPT: ${exercise.whyFollowUpPrompt || "Analyze design trade-offs"}

STUDENT SUBMISSION:
\`\`\`${exercise.techSlug}
${code}
\`\`\`

REFERENCE PATTERN:
\`\`\`${exercise.techSlug}
${exercise.referenceSolution}
\`\`\`

Return a strictly valid JSON object matching the schema:
{
  "approachEvaluation": "string evaluating the solution approach",
  "timeSpaceComplexityFeedback": "string analyzing time and space complexity",
  "followUpReflectionQuestion": "string with reflection question"
}`;
    }

    const result = await generateJSON({
      prompt,
      schema,
      technology: exercise.techSlug,
      action,
      input: cacheKeyInput,
      promptVersion: "v1.0"
    });

    return res.status(200).json({ feedback: result.data, cached: result.fromCache });
  } catch (err) {
    console.error("[TESTS] Feedback error:", err.message);
    return res.status(500).json({ error: "Failed to generate AI feedback." });
  }
});

module.exports = router;

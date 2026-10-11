const test = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const { app } = require("../server");
const { connectDB, closeDB } = require("../config/db");

test("Phase 7: Tests Module (Quizzes, Exercises & Deterministic Grading)", async (t) => {
  await connectDB();
  const server = app.listen(5093);

  const testUser = {
    userId: "64a000000000000000000002",
    email: "student@university.edu",
    name: "Student"
  };
  const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: "1h" });

  try {
    // 1. Fetch Quiz with answer keys withheld
    await t.test("GET /api/tests/quizzes/python withholds answer keys", async () => {
      const res = await fetch("http://localhost:5093/api/tests/quizzes/python", {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.techSlug, "python");
      assert.ok(data.questions.length > 0);
      for (const q of data.questions) {
        assert.strictEqual(q.correctAnswerIndex, undefined, "Answer key must be withheld from client");
        assert.strictEqual(q.explanation, undefined, "Explanation must be withheld before submission");
      }
    });

    // 2. Submit Quiz for deterministic grading
    await t.test("POST /api/tests/quizzes/python/submit evaluates strictly against database keys", async () => {
      // Intentionally supply perfect answers
      const perfectAnswers = {
        py_q1: 0, // mutable reference
        py_q2: 1, // False
        py_q3: 3, // LEGB rule
        py_q4: 1  // bool is a subclass of int
      };

      const res = await fetch("http://localhost:5093/api/tests/quizzes/python/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers: perfectAnswers })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.score, 100);
      assert.strictEqual(data.passed, true);
      assert.strictEqual(data.correctCount, 4);
      assert.ok(data.results[0].explanation, "Explanations returned after submission");
    });

    // 3. List coding exercises
    await t.test("GET /api/tests/exercises lists coding challenges", async () => {
      const res = await fetch("http://localhost:5093/api/tests/exercises", {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.exercises));
      assert.ok(data.exercises.length >= 2);
    });

    // 4. Fetch exercise with hidden test cases withheld
    await t.test("GET /api/tests/exercises/py-palindrome-clean withholds hidden test cases", async () => {
      const res = await fetch("http://localhost:5093/api/tests/exercises/py-palindrome-clean", {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.slug, "py-palindrome-clean");
      assert.strictEqual(data.techSlug, "python");
      assert.ok(data.publicTestCases.length > 0);
      // Ensure no hidden test cases leaked
      assert.strictEqual(data.testCases, undefined);
    });

    // 5. Submit reference solution against ALL (public + hidden) test cases with real runner
    await t.test("POST /api/tests/exercises/py-palindrome-clean/submit passes reference solution", async () => {
      const referenceSolution = `import sys

def is_palindrome(s: str) -> bool:
    cleaned = [c.lower() for c in s if c.isalnum()]
    return cleaned == cleaned[::-1]

input_data = sys.stdin.read().strip()
print(is_palindrome(input_data))
`;

      const res = await fetch("http://localhost:5093/api/tests/exercises/py-palindrome-clean/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: referenceSolution })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.allPassed, true, "Reference solution must pass all test cases");
      assert.strictEqual(data.passedCount, data.totalTests);
    });

    // 6. Submit buggy solution and verify failed verdict
    await t.test("POST /api/tests/exercises/py-palindrome-clean/submit catches buggy submission", async () => {
      const buggyCode = `import sys
# Buggy: does not strip spaces or punctuation
input_data = sys.stdin.read().strip()
print(input_data == input_data[::-1])
`;

      const res = await fetch("http://localhost:5093/api/tests/exercises/py-palindrome-clean/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: buggyCode })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.allPassed, false, "Buggy solution must fail");
      assert.ok(data.failedCase !== null);
    });

    // 7. Request AI tutor reflective feedback
    await t.test("POST /api/tests/exercises/py-palindrome-clean/feedback returns grounded Zod feedback", async () => {
      const res = await fetch("http://localhost:5093/api/tests/exercises/py-palindrome-clean/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: "def is_palindrome(s): return s == s[::-1]",
          passed: false,
          failedCase: {
            input: "A man, a plan, a canal: Panama",
            expectedOutput: "True",
            actualOutput: "False"
          }
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.feedback.failureAnalysis, "Must provide failure analysis");
      assert.ok(data.feedback.hintWithoutGivingAnswer, "Must provide guidance hint");
    });
  } finally {
    server.close();
    await closeDB();
  }
});

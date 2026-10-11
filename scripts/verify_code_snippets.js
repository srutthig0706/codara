const path = require("path");
require(path.resolve(__dirname, "../server/node_modules/dotenv")).config({ path: path.resolve(__dirname, "../server/.env") });
const { MongoClient } = require(path.resolve(__dirname, "../server/node_modules/mongodb"));
const { runCode } = require("../server/services/dockerRunner.service");

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/codara";

async function verifyAll() {
  console.log("==================================================");
  console.log("CODARA REAL DOCKER RUNNER CODE VERIFICATION");
  console.log("==================================================\n");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const results = {
    technologies: [],
    codeExercises: []
  };

  // 1. Verify Catalog Code Examples
  console.log("--- 1. VERIFYING CATALOG CODE EXAMPLES ---");
  const techs = await db.collection("technologies").find({}).toArray();

  for (const tech of techs) {
    if (!tech.runnableInSandbox) {
      console.log(`[READ-ONLY] ${tech.name} (${tech.slug}): Correctly flagged as runnableInSandbox = false.`);
      results.technologies.push({
        slug: tech.slug,
        name: tech.name,
        runnable: false,
        status: "read_only_verified",
        notes: "Requires external background daemon. Correctly restricted."
      });
      continue;
    }

    console.log(`[TESTING] Executing ${tech.name} snippet in real Docker runner...`);
    const lang = tech.slug === "python" ? "python" : "javascript";
    const runRes = await runCode({
      language: lang,
      code: tech.codeExample,
      timeLimitMs: 5000
    });

    const isSuccess = runRes.status === "accepted" && !runRes.stderr;
    console.log(`  -> Status: ${runRes.status}`);
    console.log(`  -> Elapsed: ${runRes.timeMs}ms`);
    console.log(`  -> Stdout: ${runRes.stdout.trim().replace(/\n/g, " ")}`);
    if (runRes.stderr) console.log(`  -> Stderr: ${runRes.stderr.trim()}`);

    results.technologies.push({
      slug: tech.slug,
      name: tech.name,
      runnable: true,
      status: isSuccess ? "verified_passed" : "failed",
      stdout: runRes.stdout.trim(),
      stderr: runRes.stderr,
      timeMs: runRes.timeMs
    });
  }

  // 2. Verify Code Exercises and Reference Solutions
  console.log("\n--- 2. VERIFYING CODE EXERCISES & REFERENCE SOLUTIONS ---");
  const exercises = await db.collection("code_exercises").find({}).toArray();

  for (const ex of exercises) {
    console.log(`\n[EXERCISE] ${ex.title} (${ex.slug}) - Language: ${ex.techSlug}`);
    const lang = ex.techSlug;
    let allTestCasesPassed = true;
    const testCaseResults = [];

    for (let i = 0; i < ex.testCases.length; i++) {
      const tc = ex.testCases[i];
      const runRes = await runCode({
        language: lang,
        code: ex.referenceSolution,
        stdin: tc.input,
        timeLimitMs: 5000
      });

      const actualTrimmed = runRes.stdout.trim();
      const expectedTrimmed = tc.expectedOutput.trim();
      const passed = runRes.status === "accepted" && actualTrimmed === expectedTrimmed;

      if (!passed) allTestCasesPassed = false;

      console.log(`  Test Case #${i + 1} (${tc.isHidden ? "HIDDEN" : "PUBLIC"}): ${passed ? "PASS" : "FAIL"}`);
      console.log(`    Input: "${tc.input}"`);
      console.log(`    Expected: "${expectedTrimmed}"`);
      console.log(`    Actual:   "${actualTrimmed}"`);
      if (runRes.stderr) console.log(`    Stderr:   "${runRes.stderr.trim()}"`);

      testCaseResults.push({
        index: i + 1,
        isHidden: tc.isHidden,
        passed,
        actual: actualTrimmed,
        expected: expectedTrimmed,
        timeMs: runRes.timeMs
      });
    }

    results.codeExercises.push({
      slug: ex.slug,
      title: ex.title,
      techSlug: ex.techSlug,
      allPassed: allTestCasesPassed,
      testCases: testCaseResults
    });
  }

  await client.close();

  console.log("\n==================================================");
  console.log("VERIFICATION SUMMARY");
  console.log("==================================================");
  console.log("Catalog Examples:", results.technologies.map(t => `${t.name}: ${t.status}`).join(" | "));
  console.log("Code Exercises:", results.codeExercises.map(e => `${e.title}: ${e.allPassed ? "ALL TESTS PASSED" : "TEST FAILURE"}`).join(" | "));

  return results;
}

if (require.main === module) {
  verifyAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Verification failed:", err);
      process.exit(1);
    });
}

module.exports = { verifyAll };

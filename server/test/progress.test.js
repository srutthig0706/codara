const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const { createProgressRouter } = require("../routes/progress.routes");
const {
  recordSectionViewed,
  recordQuizCompleted,
  recordExercisePassed,
  recordScenarioGenerated,
  getDashboard,
  addTechnologyBookmark,
  removeTechnologyBookmark
} = require("../services/progress.service");

class MemoryCollection {
  constructor(rows = []) {
    this.rows = rows;
  }

  matches(row, filter) {
    return Object.entries(filter).every(([key, value]) => row[key] === value);
  }

  findOne(filter) {
    return Promise.resolve(this.rows.find(row => this.matches(row, filter)) || null);
  }

  find(filter = {}) {
    const rows = this.rows.filter(row => this.matches(row, filter));
    return {
      project: () => ({
        toArray: async () => rows.map(row => ({ ...row }))
      }),
      toArray: async () => rows.map(row => ({ ...row }))
    };
  }

  async updateOne(filter, update, options = {}) {
    let row = this.rows.find(item => this.matches(item, filter));
    let inserted = false;
    if (!row && options.upsert) {
      row = { ...filter };
      this.rows.push(row);
      inserted = true;
    }
    if (!row) return { matchedCount: 0 };

    for (const [key, value] of Object.entries(update.$setOnInsert || {})) {
      if (inserted) row[key] = value;
    }
    for (const [key, value] of Object.entries(update.$set || {})) row[key] = value;
    for (const [key, value] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + value;
    for (const [key, value] of Object.entries(update.$max || {})) {
      row[key] = row[key] === undefined ? value : Math.max(row[key], value);
    }
    for (const [key, value] of Object.entries(update.$addToSet || {})) {
      row[key] ||= [];
      if (!row[key].includes(value)) row[key].push(value);
    }
    return { matchedCount: inserted ? 0 : 1, upsertedCount: inserted ? 1 : 0 };
  }

  async deleteOne(filter) {
    const index = this.rows.findIndex(row => this.matches(row, filter));
    if (index < 0) return { deletedCount: 0 };
    this.rows.splice(index, 1);
    return { deletedCount: 1 };
  }
}

function createMemoryDb() {
  const collections = {
    technologies: new MemoryCollection([
      { slug: "python", name: "Python", category: "Language", shortDescription: "A language." },
      { slug: "redis", name: "Redis", category: "Database", shortDescription: "An in-memory store." }
    ]),
    user_progress: new MemoryCollection(),
    code_exercises: new MemoryCollection([
      { slug: "py-one", techSlug: "python", title: "Exercise one" },
      { slug: "py-two", techSlug: "python", title: "Exercise two" },
      { slug: "redis-one", techSlug: "redis", title: "Redis exercise" }
    ]),
    user_bookmarks: new MemoryCollection()
  };
  return {
    collection: name => collections[name],
    collections
  };
}

test("Progress records only supplied events, deduplicates set events, and isolates users", async () => {
  const db = createMemoryDb();
  const userId = "student-one";

  await recordSectionViewed(db, userId, "python", "overview");
  await recordSectionViewed(db, userId, "python", "overview");
  await recordSectionViewed(db, userId, "python", "setup");
  await recordQuizCompleted(db, userId, "python", 67);
  await recordQuizCompleted(db, userId, "python", 100);
  await recordExercisePassed(db, userId, "python", "py-one");
  await recordScenarioGenerated(db, userId, "python");

  const dashboard = await getDashboard(db, userId);
  const python = dashboard.technologies.find(technology => technology.slug === "python");
  assert.deepStrictEqual(python.progress.sectionsViewed, ["overview", "setup"]);
  assert.strictEqual(python.progress.quizCompleted, true);
  assert.strictEqual(python.progress.quizBestScore, 100);
  assert.strictEqual(python.progress.quizLastScore, 100);
  assert.strictEqual(python.progress.quizAttempts, 2);
  assert.deepStrictEqual(python.progress.passedExercises, [{ slug: "py-one", title: "Exercise one" }]);
  assert.strictEqual(python.progress.scenariosGenerated, 1);
  assert.strictEqual(python.progress.completedSteps, 4);
  assert.strictEqual(python.progress.totalSteps, 8);

  const otherUserDashboard = await getDashboard(db, "student-two");
  const otherUserPython = otherUserDashboard.technologies.find(technology => technology.slug === "python");
  assert.strictEqual(otherUserPython.progress.completedSteps, 0);
  assert.strictEqual(otherUserPython.progress.scenariosGenerated, 0);
});

test("Progress records bookmarks idempotently and removes only the current user's bookmark", async () => {
  const db = createMemoryDb();
  const python = { slug: "python", name: "Python" };

  await addTechnologyBookmark(db, "student-one", python);
  await addTechnologyBookmark(db, "student-one", python);
  await addTechnologyBookmark(db, "student-two", python);
  assert.strictEqual(db.collections.user_bookmarks.rows.length, 2);

  await removeTechnologyBookmark(db, "student-one", "python");
  const firstDashboard = await getDashboard(db, "student-one");
  const secondDashboard = await getDashboard(db, "student-two");
  assert.strictEqual(firstDashboard.bookmarks.length, 0);
  assert.strictEqual(secondDashboard.bookmarks.length, 1);
});

test("Progress and bookmark routes require authentication and persist real section/bookmark events", async () => {
  const db = createMemoryDb();
  const app = express();
  app.use(express.json());
  app.use("/api/progress", createProgressRouter({ getDatabase: () => db }));
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/progress`;
  const token = jwt.sign({ userId: "student-one" }, process.env.JWT_SECRET, { expiresIn: "1h" });

  try {
    const unauthorized = await fetch(`${url}/dashboard`);
    assert.strictEqual(unauthorized.status, 401);

    const invalidSection = await fetch(`${url}/sections/python/not-a-section/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(invalidSection.status, 400);

    const viewed = await fetch(`${url}/sections/python/overview/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(viewed.status, 200);

    const bookmarked = await fetch(`${url}/bookmarks/python`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(bookmarked.status, 200);

    const reauthenticatedToken = jwt.sign({ userId: "student-one" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const dashboardResponse = await fetch(`${url}/dashboard`, {
      headers: { Authorization: `Bearer ${reauthenticatedToken}` }
    });
    const dashboard = await dashboardResponse.json();
    const python = dashboard.technologies.find(technology => technology.slug === "python");
    assert.deepStrictEqual(python.progress.sectionsViewed, ["overview"]);
    assert.strictEqual(python.bookmarked, true);
    assert.deepStrictEqual(dashboard.bookmarks.map(bookmark => bookmark.slug), ["python"]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

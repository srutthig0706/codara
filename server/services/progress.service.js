const SECTION_IDS = ["overview", "why_where", "setup", "errors", "code"];

function progressFilter(userId, techSlug) {
  return { userId: String(userId), techSlug };
}

async function recordSectionViewed(db, userId, techSlug, sectionId) {
  if (!SECTION_IDS.includes(sectionId)) {
    throw new Error(`Unsupported technology section '${sectionId}'.`);
  }
  return db.collection("user_progress").updateOne(
    progressFilter(userId, techSlug),
    {
      $addToSet: { sectionsViewed: sectionId },
      $set: { updatedAt: new Date() },
      $setOnInsert: { exercisesPassed: [], scenariosGenerated: 0 }
    },
    { upsert: true }
  );
}

async function recordQuizCompleted(db, userId, techSlug, score) {
  return db.collection("user_progress").updateOne(
    progressFilter(userId, techSlug),
    {
      $set: { quizCompleted: true, quizLastScore: score, quizCompletedAt: new Date(), updatedAt: new Date() },
      $inc: { quizAttempts: 1 },
      $max: { quizBestScore: score },
      $setOnInsert: { sectionsViewed: [], exercisesPassed: [], scenariosGenerated: 0 }
    },
    { upsert: true }
  );
}

async function recordExercisePassed(db, userId, techSlug, exerciseSlug) {
  return db.collection("user_progress").updateOne(
    progressFilter(userId, techSlug),
    {
      $addToSet: { exercisesPassed: exerciseSlug },
      $set: { updatedAt: new Date() },
      $setOnInsert: { sectionsViewed: [], scenariosGenerated: 0 }
    },
    { upsert: true }
  );
}

async function recordScenarioGenerated(db, userId, techSlug) {
  return db.collection("user_progress").updateOne(
    progressFilter(userId, techSlug),
    {
      $inc: { scenariosGenerated: 1 },
      $set: { lastScenarioGeneratedAt: new Date(), updatedAt: new Date() },
      $setOnInsert: { sectionsViewed: [], exercisesPassed: [] }
    },
    { upsert: true }
  );
}

async function getDashboard(db, userId) {
  const [technologies, progressRows, exercises, bookmarkRows] = await Promise.all([
    db.collection("technologies").find({})
      .project({ slug: 1, name: 1, category: 1, shortDescription: 1 })
      .toArray(),
    db.collection("user_progress").find({ userId: String(userId) }).toArray(),
    db.collection("code_exercises").find({})
      .project({ slug: 1, techSlug: 1, title: 1 })
      .toArray(),
    db.collection("user_bookmarks").find({ userId: String(userId) }).toArray()
  ]);

  const progressBySlug = new Map(progressRows.map(row => [row.techSlug, row]));
  const exerciseTitles = new Map(exercises.map(exercise => [exercise.slug, exercise.title]));
  const bookmarksBySlug = new Map(bookmarkRows.map(bookmark => [bookmark.techSlug, bookmark]));
  const technologiesWithProgress = technologies.map(technology => {
    const progress = progressBySlug.get(technology.slug) || {};
    const technologyExercises = exercises.filter(exercise => exercise.techSlug === technology.slug);
    const sectionsViewed = SECTION_IDS.filter(sectionId =>
      (progress.sectionsViewed || []).includes(sectionId)
    );
    const passedExerciseSlugs = technologyExercises
      .filter(exercise => (progress.exercisesPassed || []).includes(exercise.slug))
      .map(exercise => exercise.slug);
    const completedSteps = sectionsViewed.length +
      (progress.quizCompleted ? 1 : 0) +
      passedExerciseSlugs.length;
    const totalSteps = SECTION_IDS.length + 1 + technologyExercises.length;
    const bookmark = bookmarksBySlug.get(technology.slug);

    return {
      ...technology,
      progress: {
        sectionsViewed,
        quizCompleted: Boolean(progress.quizCompleted),
        quizBestScore: progress.quizBestScore ?? null,
        quizLastScore: progress.quizLastScore ?? null,
        quizAttempts: progress.quizAttempts ?? 0,
        passedExercises: passedExerciseSlugs.map(slug => ({
          slug,
          title: exerciseTitles.get(slug) || slug
        })),
        scenariosGenerated: progress.scenariosGenerated ?? 0,
        completedSteps,
        totalSteps,
        completionPercent: Math.round((completedSteps / totalSteps) * 100)
      },
      bookmarked: Boolean(bookmark),
      bookmarkedAt: bookmark?.createdAt || null
    };
  });

  return {
    technologies: technologiesWithProgress,
    bookmarks: technologiesWithProgress
      .filter(technology => technology.bookmarked)
      .map(({ slug, name, category, shortDescription, bookmarkedAt }) => ({
        slug,
        name,
        category,
        shortDescription,
        bookmarkedAt
      }))
  };
}

async function addTechnologyBookmark(db, userId, technology) {
  const collection = db.collection("user_bookmarks");
  await collection.updateOne(
    { userId: String(userId), techSlug: technology.slug },
    {
      $setOnInsert: {
        userId: String(userId),
        techSlug: technology.slug,
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
}

async function removeTechnologyBookmark(db, userId, techSlug) {
  return db.collection("user_bookmarks").deleteOne({
    userId: String(userId),
    techSlug
  });
}

module.exports = {
  SECTION_IDS,
  recordSectionViewed,
  recordQuizCompleted,
  recordExercisePassed,
  recordScenarioGenerated,
  getDashboard,
  addTechnologyBookmark,
  removeTechnologyBookmark
};

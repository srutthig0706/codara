const express = require("express");
const { getDB } = require("../config/db");

const router = express.Router();

// GET /api/technologies - list all technologies in catalog
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const list = await db.collection("technologies")
      .find({})
      .project({
        slug: 1,
        name: 1,
        category: 1,
        shortDescription: 1,
        runnableInSandbox: 1,
        reviewStatus: 1,
        sourceName: 1,
        sourceUrl: 1,
        license: 1
      })
      .toArray();

    return res.status(200).json({ technologies: list });
  } catch (err) {
    console.error("[TECH] Error fetching technology catalog:", err.message);
    return res.status(500).json({ error: "Failed to fetch technology catalog." });
  }
});

// GET /api/technologies/:slug - get detailed static content for a specific technology
router.get("/:slug", async (req, res) => {
  try {
    const db = getDB();
    const tech = await db.collection("technologies").findOne({ slug: req.params.slug });

    if (!tech) {
      return res.status(404).json({ error: `Technology '${req.params.slug}' not found.` });
    }

    return res.status(200).json({ technology: tech });
  } catch (err) {
    console.error("[TECH] Error fetching technology detail:", err.message);
    return res.status(500).json({ error: "Failed to fetch technology details." });
  }
});

module.exports = router;

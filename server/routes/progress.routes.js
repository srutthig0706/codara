const express = require("express");
const { getDB } = require("../config/db");
const authMiddleware = require("../middleware/auth");
const { SECTION_IDS, getDashboard, recordSectionViewed, addTechnologyBookmark, removeTechnologyBookmark } = require("../services/progress.service");

function createProgressRouter({ getDatabase = getDB } = {}) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get("/dashboard", async (req, res) => {
    try {
      const dashboard = await getDashboard(getDatabase(), req.user.userId);
      return res.status(200).json(dashboard);
    } catch (error) {
      console.error("[PROGRESS] Failed to load dashboard:", error.message);
      return res.status(500).json({ error: "Failed to load learning progress." });
    }
  });

  router.post("/sections/:techSlug/:sectionId/view", async (req, res) => {
    const { techSlug, sectionId } = req.params;
    if (!SECTION_IDS.includes(sectionId)) {
      return res.status(400).json({ error: "Unknown technology section." });
    }

    try {
      const db = getDatabase();
      const technology = await db.collection("technologies").findOne({ slug: techSlug }, { projection: { slug: 1 } });
      if (!technology) {
        return res.status(404).json({ error: "Technology not found." });
      }
      await recordSectionViewed(db, req.user.userId, techSlug, sectionId);
      return res.status(200).json({ recorded: true, techSlug, sectionId });
    } catch (error) {
      console.error("[PROGRESS] Failed to record section view:", error.message);
      return res.status(500).json({ error: "Failed to record section view." });
    }
  });

  router.put("/bookmarks/:techSlug", async (req, res) => {
    try {
      const db = getDatabase();
      const technology = await db.collection("technologies").findOne(
        { slug: req.params.techSlug },
        { projection: { slug: 1, name: 1 } }
      );
      if (!technology) {
        return res.status(404).json({ error: "Technology not found." });
      }
      await addTechnologyBookmark(db, req.user.userId, technology);
      return res.status(200).json({ bookmarked: true, techSlug: technology.slug });
    } catch (error) {
      console.error("[PROGRESS] Failed to bookmark technology:", error.message);
      return res.status(500).json({ error: "Failed to bookmark technology." });
    }
  });

  router.delete("/bookmarks/:techSlug", async (req, res) => {
    try {
      const db = getDatabase();
      const technology = await db.collection("technologies").findOne(
        { slug: req.params.techSlug },
        { projection: { slug: 1 } }
      );
      if (!technology) {
        return res.status(404).json({ error: "Technology not found." });
      }
      await removeTechnologyBookmark(db, req.user.userId, technology.slug);
      return res.status(200).json({ bookmarked: false, techSlug: technology.slug });
    } catch (error) {
      console.error("[PROGRESS] Failed to remove technology bookmark:", error.message);
      return res.status(500).json({ error: "Failed to remove technology bookmark." });
    }
  });

  return router;
}

module.exports = createProgressRouter();
module.exports.createProgressRouter = createProgressRouter;

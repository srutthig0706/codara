const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { RegisterSchema, LoginSchema } = require("../schemas/auth.schema");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Ensure unique index on email
let indexEnsured = false;
async function ensureIndex(db) {
  if (!indexEnsured) {
    try {
      await db.collection("users").createIndex({ email: 1 }, { unique: true });
      indexEnsured = true;
    } catch (e) {
      // index might already exist
    }
  }
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.flatten().fieldErrors 
      });
    }

    const { name, email, password } = parseResult.data;
    const db = getDB();
    await ensureIndex(db);

    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      name,
      email,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await db.collection("users").insertOne(newUser);
    const userId = insertResult.insertedId.toString();

    const token = jwt.sign(
      { userId, email, name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "User registered successfully",
      user: { id: userId, name, email },
      token
    });
  } catch (err) {
    console.error("[AUTH] Register error:", err.message);
    return res.status(500).json({ error: "Internal server error during registration." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.flatten().fieldErrors 
      });
    }

    const { email, password } = parseResult.data;
    const db = getDB();

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const userId = user._id.toString();
    const token = jwt.sign(
      { userId, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      user: { id: userId, name: user.name, email: user.email },
      token
    });
  } catch (err) {
    console.error("[AUTH] Login error:", err.message);
    return res.status(500).json({ error: "Internal server error during login." });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { passwordHash: 0 } }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error("[AUTH] Get me error:", err.message);
    return res.status(500).json({ error: "Internal server error fetching user profile." });
  }
});

module.exports = router;

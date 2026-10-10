const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/codara";
let client = null;
let db = null;

async function connectDB() {
  if (db) return db;
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db();
    console.log("[DB] Connected to MongoDB successfully.");
    return db;
  } catch (err) {
    console.error("[DB] MongoDB connection error:", err.message);
    throw err;
  }
}

function getDB() {
  if (!db) {
    throw new Error("[DB] Database not initialized. Call connectDB() first.");
  }
  return db;
}

async function pingDB() {
  try {
    if (!db) await connectDB();
    await db.command({ ping: 1 });
    return true;
  } catch (err) {
    return false;
  }
}

async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("[DB] MongoDB connection closed.");
  }
}

module.exports = {
  connectDB,
  getDB,
  pingDB,
  closeDB
};

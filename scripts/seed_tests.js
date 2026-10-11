const path = require("path");
require(path.resolve(__dirname, "../server/node_modules/dotenv")).config({ path: path.resolve(__dirname, "../server/.env") });
const { MongoClient } = require(path.resolve(__dirname, "../server/node_modules/mongodb"));

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/codara";

const quizzes = [
  {
    techSlug: "python",
    title: "Python Memory, Scoping, and Mutability",
    questions: [
      {
        id: "py_q1",
        type: "mcq",
        question: "What happens when a list is passed as an argument to a Python function and modified using .append()?",
        options: [
          "Python raises an UnboundLocalError",
          "The caller's original list is modified in place because lists are mutable references",
          "Python creates an automatic deep copy of the list inside the function",
          "The list is converted to an immutable tuple"
        ],
        correctAnswerIndex: 1,
        explanation: "Python passes arguments by object reference (assignment). Since lists are mutable objects, operations modifying the object in place directly affect the caller's instance."
      },
      {
        id: "py_q2",
        type: "tf",
        question: "True or False: Python strings and tuples can have their elements mutated in place after instantiation.",
        options: [
          "True",
          "False"
        ],
        correctAnswerIndex: 1,
        explanation: "False. In Python, both str and tuple are immutable types. Attempting to assign to an index raises a TypeError."
      },
      {
        id: "py_q3",
        type: "mcq",
        question: "What order does Python follow when resolving variable names?",
        options: [
          "Global -> Local -> Built-in -> Enclosing",
          "Local -> Enclosing -> Global -> Built-in (LEGB rule)",
          "Built-in -> Global -> Enclosing -> Local",
          "Local -> Global only"
        ],
        correctAnswerIndex: 1,
        explanation: "Python resolves identifiers using the LEGB hierarchy: Local, Enclosing function scope, Global (module), and Built-in."
      }
    ]
  },
  {
    techSlug: "javascript",
    title: "Node.js Event Loop & Asynchronous Architecture",
    questions: [
      {
        id: "js_q1",
        type: "mcq",
        question: "In what phase does Node.js execute Promise resolution callbacks (.then / await)?",
        options: [
          "Timers phase of the event loop",
          "Immediately in the microtask queue before moving to the next macrotask phase",
          "Check phase (setImmediate)",
          "Operating system kernel thread pool"
        ],
        correctAnswerIndex: 1,
        explanation: "Promise resolutions and process.nextTick callbacks enter the microtask queue, which drains immediately after the current script run completes and before the next event loop phase."
      },
      {
        id: "js_q2",
        type: "tf",
        question: "True or False: Running a CPU-intensive while(true) loop in Node.js does not block other concurrent incoming HTTP requests.",
        options: [
          "True",
          "False"
        ],
        correctAnswerIndex: 1,
        explanation: "False. Because JavaScript in Node.js executes on a single main event loop thread, synchronous CPU-intensive loops completely block the event loop from processing I/O."
      }
    ]
  },
  {
    techSlug: "redis",
    title: "Redis In-Memory Architecture & Key Expiration",
    questions: [
      {
        id: "redis_q1",
        type: "mcq",
        question: "Why does Redis achieve sub-millisecond execution times for operational commands?",
        options: [
          "It compiles SQL into machine code at runtime",
          "Data resides primarily in physical RAM and operations are processed sequentially by a single-threaded event loop without lock contention",
          "It writes to disk before acknowledging every command",
          "It shards data across hundreds of GPUs"
        ],
        correctAnswerIndex: 1,
        explanation: "Redis keeps the dataset in RAM and runs commands on a non-blocking single-threaded event loop, avoiding disk I/O bottlenecks and multi-threaded mutex locking."
      },
      {
        id: "redis_q2",
        type: "mcq",
        question: "What happens when Redis reaches 'maxmemory' under the 'allkeys-lru' eviction policy?",
        options: [
          "It crashes with a kernel panic",
          "It returns an Out-Of-Memory (OOM) error for all writes",
          "It automatically evicts the least recently used keys to free space",
          "It pauses writes and writes all keys to disk"
        ],
        correctAnswerIndex: 2,
        explanation: "Under 'allkeys-lru', Redis frees memory by evicting the least recently used keys across all stored keys."
      }
    ]
  }
];

const codeExercises = [
  {
    slug: "py-palindrome-clean",
    techSlug: "python",
    title: "Valid Alphanumeric Palindrome",
    description: "Write a function `is_palindrome(s: str) -> bool` that returns True if the string is a palindrome, considering only alphanumeric characters and ignoring casing. Returns False otherwise.",
    difficulty: "Beginner",
    languageId: 71,
    starterCode: `# Write a function to check if a string is a palindrome
def is_palindrome(s: str) -> bool:
    # Your code here
    pass

# Test invocation
import sys
input_data = sys.stdin.read().strip()
print(is_palindrome(input_data))
`,
    referenceSolution: `import sys

def is_palindrome(s: str) -> bool:
    cleaned = [c.lower() for c in s if c.isalnum()]
    return cleaned == cleaned[::-1]

input_data = sys.stdin.read().strip()
print(is_palindrome(input_data))
`,
    testCases: [
      { input: "A man, a plan, a canal: Panama", expectedOutput: "True", isHidden: false },
      { input: "race a car", expectedOutput: "False", isHidden: false },
      { input: " ", expectedOutput: "True", isHidden: true },
      { input: "0P", expectedOutput: "False", isHidden: true }
    ],
    whyFollowUpPrompt: "Why did you choose your filtering approach (e.g. list comprehension vs. two-pointer in-place scanning)? What are the time and space complexity trade-offs?"
  },
  {
    slug: "js-count-occurrences",
    techSlug: "javascript",
    title: "Word Frequency Counter",
    description: "Write a program that reads a string from stdin and outputs a JSON string containing word frequencies in lowercase, stripped of punctuation.",
    difficulty: "Beginner",
    languageId: 63,
    starterCode: `const fs = require('fs');

function countWords(text) {
  // Your code here
  return {};
}

const input = fs.readFileSync(0, 'utf-8').trim();
console.log(JSON.stringify(countWords(input)));
`,
    referenceSolution: `const fs = require('fs');

function countWords(text) {
  if (!text) return {};
  const words = text.toLowerCase().match(/\\b[a-z0-9]+\\b/g) || [];
  const map = {};
  for (const w of words) {
    map[w] = (map[w] || 0) + 1;
  }
  return map;
}

const input = fs.readFileSync(0, 'utf-8').trim();
console.log(JSON.stringify(countWords(input)));
`,
    testCases: [
      { input: "hello world hello", expectedOutput: '{"hello":2,"world":1}', isHidden: false },
      { input: "Node.js is fast. Fast is good.", expectedOutput: '{"node":1,"js":1,"is":2,"fast":2,"good":1}', isHidden: false },
      { input: "", expectedOutput: '{}', isHidden: true }
    ],
    whyFollowUpPrompt: "Why did you choose your parsing strategy (regular expressions vs split/filter)? How would your solution handle memory pressure with a 1GB streaming input?"
  }
];

async function seed() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    // 1. Seed Quizzes
    const quizColl = db.collection("quizzes");
    await quizColl.createIndex({ techSlug: 1 });
    for (const q of quizzes) {
      await quizColl.updateOne(
        { techSlug: q.techSlug },
        { $set: q },
        { upsert: true }
      );
      console.log(`[Seed] Quiz synced for ${q.techSlug}`);
    }

    // 2. Seed Code Exercises
    const exColl = db.collection("code_exercises");
    await exColl.createIndex({ slug: 1 }, { unique: true });
    for (const ex of codeExercises) {
      await exColl.updateOne(
        { slug: ex.slug },
        { $set: ex },
        { upsert: true }
      );
      console.log(`[Seed] Exercise synced: ${ex.title} (${ex.slug})`);
    }

    console.log("[Seed] Test modules (quizzes & coding exercises) successfully seeded!");
  } catch (err) {
    console.error("[Seed] Test seeding failed:", err.message);
  } finally {
    await client.close();
  }
}

seed();

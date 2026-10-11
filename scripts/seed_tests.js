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
          "The caller's original list is modified in place because lists are mutable references",
          "Python raises an UnboundLocalError",
          "Python creates an automatic deep copy of the list inside the function",
          "The list is converted to an immutable tuple"
        ],
        correctAnswerIndex: 0,
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
          "Built-in -> Global -> Enclosing -> Local",
          "Local -> Global only",
          "Local -> Enclosing -> Global -> Built-in (LEGB rule)"
        ],
        correctAnswerIndex: 3,
        explanation: "Python resolves identifiers using the LEGB hierarchy: Local, Enclosing function scope, Global (module), and Built-in."
      },
      {
        id: "py_q4",
        type: "tf",
        question: "True or False: In Python, bool is a subclass of int, so True and False behave like 1 and 0 in numeric contexts.",
        options: [
          "False",
          "True"
        ],
        correctAnswerIndex: 1,
        explanation: "True. Python's bool type is a subclass of int: True has the numeric value 1 and False has the numeric value 0, though they remain distinct boolean values."
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
        question: "When does Node.js run Promise callbacks (.then / await continuations)?",
        options: [
          "Timers phase of the event loop",
          "Check phase (setImmediate)",
          "From the microtask queue, right after the current operation finishes and before the event loop moves on",
          "Operating system kernel thread pool"
        ],
        correctAnswerIndex: 2,
        explanation: "Promise callbacks run from the microtask queue. Node.js drains it after the current operation finishes and before the event loop continues to its next callback or phase. process.nextTick callbacks have their own queue, which runs before promise microtasks."
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
          "It automatically evicts the least recently used keys to free space",
          "It returns an Out-Of-Memory (OOM) error for all writes",
          "It crashes with a kernel panic",
          "It pauses writes and writes all keys to disk"
        ],
        correctAnswerIndex: 0,
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
    description: "Read a string from stdin. Lowercase it, split it into words on every non-alphanumeric character (so 'Node.js' becomes 'node' and 'js'), count each word, and print the counts with JSON.stringify. Key order does not matter.",
    difficulty: "Beginner",
    outputComparison: "json",
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
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
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

const path = require("path");
require(path.resolve(__dirname, "../server/node_modules/dotenv")).config({ path: path.resolve(__dirname, "../server/.env") });
const { MongoClient } = require(path.resolve(__dirname, "../server/node_modules/mongodb"));

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/codara";

const technologies = [
  {
    slug: "python",
    name: "Python",
    category: "Programming Language",
    shortDescription: "An interpreted, high-level, dynamically typed language emphasizing readability and developer productivity.",
    overview: "Python is an interpreted, general-purpose language designed by Guido van Rossum in 1991. It features automatic memory management, dynamic typing, and a vast standard library ('batteries included'). Programs compile to bytecode (.pyc) executed by the CPython virtual machine.",
    whyExists: "Prior languages (like C and C++) required explicit manual memory allocation, complex syntax, and lengthy compile-link cycles. Python was engineered to maximize developer velocity, eliminate boilerplate syntax, and allow clean algorithmic expression without low-level cognitive overhead.",
    whereUsed: "Machine Learning (PyTorch, TensorFlow), Data Engineering & Analysis (Pandas, Polars), Web Backend APIs (FastAPI, Django, Flask), DevOps automation, and scientific computing.",
    setupGuide: "1. Download Python 3.12+ from python.org.\n2. Verify installation: `python --version`\n3. Create virtual environment: `python -m venv .venv`\n4. Activate on Windows: `.\\.venv\\Scripts\\Activate.ps1`\n5. Install packages: `pip install <package_name>`",
    commonErrors: [
      {
        error: "IndentationError: unexpected indent / unindent does not match any outer indentation level",
        cause: "Mixing tabs and spaces, or misaligning whitespace blocks inside control flow structures.",
        fix: "Configure your editor to convert tabs to 4 spaces and format consistently."
      },
      {
        error: "TypeError: unsupported operand type(s) for +: 'int' and 'str'",
        cause: "Attempting implicit string concatenation with an integer without explicit type casting.",
        fix: "Cast the integer with `str(value)` or use f-strings: `f'Count is {value}'`."
      },
      {
        error: "UnboundLocalError: local variable referenced before assignment",
        cause: "Assigning to a variable inside a function scope when Python treats it as local, but reading it prior to assignment.",
        fix: "Declare `global var_name` or `nonlocal var_name`, or pass the variable as an explicit argument."
      }
    ],
    codeExample: `# Python Memory & Scope Demonstration\ndef calculate_discount(price: float, discount_percent: float) -> float:\n    """Calculates discounted price with bounds checking."""\n    if discount_percent < 0 or discount_percent > 100:\n        raise ValueError("Discount must be between 0 and 100")\n    discount_amount = price * (discount_percent / 100)\n    return round(price - discount_amount, 2)\n\n# Test execution\noriginal = 120.00\ndiscount = 15.0\nfinal_price = calculate_discount(original, discount)\nprint(f"Original: {original}, After {discount}% discount: {final_price}")\n`,
    runnableInSandbox: true,
    sourceName: "Python Official Documentation",
    sourceUrl: "https://docs.python.org/3/",
    license: "Python Software Foundation License (PSFL)",
    reviewStatus: "needs human review",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    slug: "javascript",
    name: "JavaScript (Node.js)",
    category: "Runtime & Scripting",
    shortDescription: "A single-threaded, non-blocking, event-driven JavaScript runtime built on Chrome's V8 engine.",
    overview: "JavaScript was created for browser scripting by Brendan Eich in 1995 and expanded to server-side systems with Ryan Dahl's Node.js in 2009. It utilizes an event-loop concurrency model with asynchronous I/O primitives, running on Google's open-source V8 JavaScript engine.",
    whyExists: "Traditional server runtimes (such as Apache with mod_php or classic Java thread pools) allocated one operating system thread per client connection, hitting scaling bottlenecks ('C10K problem') due to thread context-switching overhead. Node.js introduced non-blocking asynchronous event loops to handle thousands of concurrent I/O connections efficiently on a single process thread.",
    whereUsed: "Full-stack web applications, real-time WebSocket backends (chat, collaboration tools), REST & GraphQL APIs, microservices, and serverless compute handlers (AWS Lambda).",
    setupGuide: "1. Install Node.js LTS from nodejs.org.\n2. Verify installation: `node -v` and `npm -v`\n3. Initialize project: `npm init -y`\n4. Run script: `node index.js`",
    commonErrors: [
      {
        error: "TypeError: Cannot read properties of undefined (reading 'x')",
        cause: "Attempting to access a property or method on a variable whose value is null or undefined.",
        fix: "Use optional chaining: `data?.user?.profile` or provide default fallback values."
      },
      {
        error: "UnhandledPromiseRejection / Unhandled exception in async function",
        cause: "An asynchronous Promise rejected without an attached `.catch()` handler or `try...catch` block inside an `await` statement.",
        fix: "Wrap `await` operations in `try { ... } catch (err) { ... }` blocks."
      },
      {
        error: "ReferenceError: require is not defined in ES module scope",
        cause: "Using CommonJS `require()` in a project configured with `\"type\": \"module\"` in package.json.",
        fix: "Use ES Module syntax: `import x from 'x'` or remove `\"type\": \"module\"`."
      }
    ],
    codeExample: `// Node.js Event Loop & Non-Blocking Asynchronous Demonstration\nfunction simulateAsyncFetch(requestId) {\n  return new Promise((resolve) => {\n    setTimeout(() => {\n      resolve({ id: requestId, status: 'fetched', timestamp: Date.now() });\n    }, 100);\n  });\n}\n\nasync function main() {\n  console.log('Initiating async operations...');\n  const results = await Promise.all([\n    simulateAsyncFetch(101),\n    simulateAsyncFetch(102)\n  ]);\n  console.log('Completed requests:', results.map(r => r.id));\n}\n\nmain();\n`,
    runnableInSandbox: true,
    sourceName: "Node.js Official Documentation",
    sourceUrl: "https://nodejs.org/docs/latest/api/",
    license: "MIT License",
    reviewStatus: "needs human review",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    slug: "redis",
    name: "Redis",
    category: "In-Memory Data Store",
    shortDescription: "An in-memory data structure store used as an ultra-low-latency database, cache, and message broker.",
    overview: "Redis (Remote Dictionary Server) is an in-memory key-value data structure store designed by Salvatore Sanfilippo in 2009. Because data lives primarily in RAM rather than spinning disks or NVMe drives, operations routinely execute in sub-millisecond durations.",
    whyExists: "Relational and document databases must persist transactions to disk (WAL / journal files), incurring I/O overhead that bottlenecks high-throughput operations like user session stores, rate-limiting counters, and real-time gaming leaderboards. Redis provides volatile and persistent in-memory data structures to offload disk-bound databases.",
    whereUsed: "Session caching, API rate limiting, leaderboard sorting (Sorted Sets), pub/sub message brokers, and transient feature flags.",
    setupGuide: "1. Install via Docker: `docker run -d -p 6379:6379 --name codara-redis redis:alpine`\n2. Verify with redis-cli: `docker exec -it codara-redis redis-cli ping`\n3. In Node.js: `npm install ioredis`",
    commonErrors: [
      {
        error: "OOM command not allowed when used memory > 'maxmemory'",
        cause: "Redis filled its assigned RAM quota and no eviction policy was configured to prune expired or LRU keys.",
        fix: "Set `maxmemory-policy allkeys-lru` or `volatile-lru` in `redis.conf`."
      },
      {
        error: "WRONGTYPE Operation against a key holding the wrong kind of value",
        cause: "Invoking a data structure command on a mismatched key type (e.g., executing `HGET` on a string key or `LPUSH` on a set).",
        fix: "Inspect key type using `TYPE key_name` before invoking specialized structure commands."
      },
      {
        error: "READONLY You can't write against a read only replica",
        cause: "Attempting to issue write operations (`SET`, `HSET`) against a replication read-replica node.",
        fix: "Target write commands strictly to the primary Redis node."
      }
    ],
    codeExample: `// [Read-Only Example: Requires Local / Containerized Redis Daemon]\n// Connect to Redis via ioredis\nconst Redis = require('ioredis');\nconst redis = new Redis('redis://localhost:6379');\n\nasync function cacheUserSession(sessionId, userData) {\n  // Store session with 1 hour TTL (3600 seconds)\n  await redis.set(\`session:\${sessionId}\`, JSON.stringify(userData), 'EX', 3600);\n  \n  // Retrieve cached session\n  const cached = await redis.get(\`session:\${sessionId}\`);\n  return JSON.parse(cached);\n}\n`,
    runnableInSandbox: false,
    sourceName: "Redis Official Documentation",
    sourceUrl: "https://redis.io/docs/latest/",
    license: "RSALv2 / SSPLv1",
    reviewStatus: "needs human review",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function seed() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection("technologies");

    await collection.createIndex({ slug: 1 }, { unique: true });

    for (const tech of technologies) {
      await collection.updateOne(
        { slug: tech.slug },
        { $set: tech },
        { upsert: true }
      );
      console.log(`[Seed] Technology synced: ${tech.name} (${tech.slug})`);
    }
    console.log("[Seed] Technology seeding completed successfully.");
  } catch (err) {
    console.error("[Seed] Seeding failed:", err.message);
  } finally {
    await client.close();
  }
}

seed();

const path = require("path");
require(path.resolve(__dirname, "../server/node_modules/dotenv")).config({ path: path.resolve(__dirname, "../server/.env") });
const { MongoClient } = require(path.resolve(__dirname, "../server/node_modules/mongodb"));
const { getEmbedding } = require("../server/services/rag.service");

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/codara";

const docChunks = [
  // --- PYTHON CHUNKS ---
  {
    techSlug: "python",
    sourceName: "Python Official Documentation",
    sourceUrl: "https://docs.python.org/3/",
    license: "Python Software Foundation License (PSFL)",
    sectionTitle: "Python Execution Model and Bytecode",
    content: "Python code is compiled into an intermediate bytecode format (.pyc files) before being executed by the CPython virtual machine. The CPython runtime is an interpreter that uses an evaluation loop to process bytecode instructions sequentially. Variables in Python are pointers (references) to objects located on the heap, and memory management is handled via reference counting coupled with a generational cyclic garbage collector."
  },
  {
    techSlug: "python",
    sourceName: "Python Official Documentation",
    sourceUrl: "https://docs.python.org/3/",
    license: "Python Software Foundation License (PSFL)",
    sectionTitle: "Mutability and Parameter Passing in Python",
    content: "In Python, arguments are passed by assignment (call-by-object-reference). Immutable types such as integers, strings, and tuples cannot be altered in place; operations that appear to modify them produce new objects. Mutable objects such as lists, dictionaries, and sets can be modified in place. Passing a mutable object into a function allows the function to mutate the original caller's data structure unless an explicit shallow or deep copy is created."
  },
  {
    techSlug: "python",
    sourceName: "Python Official Documentation",
    sourceUrl: "https://docs.python.org/3/",
    license: "Python Software Foundation License (PSFL)",
    sectionTitle: "Variable Scoping and the LEGB Rule",
    content: "Python resolves variable identifiers using the LEGB scope hierarchy: Local, Enclosing (nested functions), Global (module level), and Built-in. If an identifier is assigned to within a function scope without being declared with the 'global' or 'nonlocal' keyword, Python treats that identifier as strictly local. Referencing a variable prior to its local assignment raises an UnboundLocalError."
  },
  {
    techSlug: "python",
    sourceName: "Python Official Documentation",
    sourceUrl: "https://docs.python.org/3/",
    license: "Python Software Foundation License (PSFL)",
    sectionTitle: "Indentation and Block Syntax Rules",
    content: "Unlike C-family languages that use braces, Python uses whitespace indentation to define code blocks for conditionals, loops, functions, and classes. A standard convention is 4 spaces per indentation level. Mixing tabs and spaces produces an IndentationError. Consistent indentation ensures visual alignment mirrors algorithmic control flow."
  },
  {
    techSlug: "python",
    sourceName: "Python Official Documentation",
    sourceUrl: "https://docs.python.org/3/",
    license: "Python Software Foundation License (PSFL)",
    sectionTitle: "Virtual Environments and Dependency Isolation",
    content: "Python virtual environments (created via 'python -m venv .venv') isolate project-specific dependencies from system-wide libraries. This prevents version collisions between conflicting package requirements across different applications on the same machine. Activating a virtual environment prepends its bin or Scripts directory to the operating system PATH."
  },

  // --- JAVASCRIPT / NODE.JS CHUNKS ---
  {
    techSlug: "javascript",
    sourceName: "Node.js Official Documentation",
    sourceUrl: "https://nodejs.org/docs/latest/api/",
    license: "MIT License",
    sectionTitle: "Node.js Event Loop and Non-Blocking Concurrency",
    content: "Node.js runs single-threaded JavaScript execution on Chrome's V8 engine, backed by the libuv C library for asynchronous I/O. The event loop consists of discrete phases: timers (setTimeout, setInterval), pending callbacks, idle/prepare, poll (retrieving new I/O events), check (setImmediate), and close callbacks. Synchronous CPU-intensive operations block the entire event loop, freezing concurrent request handling."
  },
  {
    techSlug: "javascript",
    sourceName: "Node.js Official Documentation",
    sourceUrl: "https://nodejs.org/docs/latest/api/",
    license: "MIT License",
    sectionTitle: "Promises, Async/Await, and the Microtask Queue",
    content: "Asynchronous JavaScript utilizes Promises and async/await syntax to organize asynchronous control flow. Promise resolution handlers (.then, .catch, .finally) and process.nextTick callbacks are scheduled in the microtask queue. Microtasks execute immediately after the current synchronous script run and before the event loop advances to the next macrotask phase."
  },
  {
    techSlug: "javascript",
    sourceName: "Node.js Official Documentation",
    sourceUrl: "https://nodejs.org/docs/latest/api/",
    license: "MIT License",
    sectionTitle: "CommonJS vs ECMAScript Modules (ESM)",
    content: "Node.js supports two module systems: CommonJS (synchronous require() and module.exports) and ECMAScript Modules (asynchronous import/export). ES Modules are activated via 'type': 'module' in package.json or using the .mjs file extension. In ES module scope, require, __dirname, and __filename are not defined by default and require import.meta helpers."
  },
  {
    techSlug: "javascript",
    sourceName: "Node.js Official Documentation",
    sourceUrl: "https://nodejs.org/docs/latest/api/",
    license: "MIT License",
    sectionTitle: "Asynchronous Error Propagation and Rejections",
    content: "Errors in asynchronous Node.js operations cannot be caught by wrapping a callback caller in a synchronous try/catch block. Instead, callbacks adhere to the error-first convention where the first argument is an Error object. With Promises and async/await, unhandled promise rejections terminate the Node.js process unless an explicit rejection handler or process 'unhandledRejection' listener is attached."
  },
  {
    techSlug: "javascript",
    sourceName: "Node.js Official Documentation",
    sourceUrl: "https://nodejs.org/docs/latest/api/",
    license: "MIT License",
    sectionTitle: "Streams and Backpressure Management",
    content: "Node.js Streams process data chunk by chunk without loading an entire file or payload into memory at once. There are four stream types: Readable, Writable, Duplex, and Transform. Backpressure occurs when a writable destination cannot consume data as fast as a readable stream provides it; piping automatically buffers and pauses reading to prevent buffer memory exhaustion."
  },

  // --- REDIS CHUNKS ---
  {
    techSlug: "redis",
    sourceName: "Redis Official Documentation",
    sourceUrl: "https://redis.io/docs/latest/",
    license: "RSALv2 / SSPLv1",
    sectionTitle: "Redis In-Memory Architecture and Single-Threaded Event Loop",
    content: "Redis is an in-memory key-value data structure store. Because data is resident in physical RAM rather than disk storage, read and write latencies remain in sub-millisecond ranges. The core engine processes operational commands sequentially via a single-threaded multiplexed event loop, eliminating lock contention, mutex overhead, and race conditions on individual command executions."
  },
  {
    techSlug: "redis",
    sourceName: "Redis Official Documentation",
    sourceUrl: "https://redis.io/docs/latest/",
    license: "RSALv2 / SSPLv1",
    sectionTitle: "Key Expiration (TTL) and Memory Eviction Policies",
    content: "Redis allows setting a Time-To-Live (TTL) on any key via commands like EXPIRE or SETEX. Expired keys are evicted passively upon read access and actively through periodic background scanning. When memory reaches 'maxmemory', Redis evicts keys according to the configured eviction policy: noeviction (returns OOM error), allkeys-lru (least recently used key evicted), or volatile-ttl (key with shortest remaining TTL evicted)."
  },
  {
    techSlug: "redis",
    sourceName: "Redis Official Documentation",
    sourceUrl: "https://redis.io/docs/latest/",
    license: "RSALv2 / SSPLv1",
    sectionTitle: "Redis Hashes and Memory Efficiency",
    content: "Redis Hashes represent collections of field-value pairs stored within a single key, making them ideal for representing objects such as user profiles or session states. Small hashes are encoded as ziplists or listpacks in contiguous memory, reducing memory overhead significantly compared to storing individual string keys for each attribute."
  },
  {
    techSlug: "redis",
    sourceName: "Redis Official Documentation",
    sourceUrl: "https://redis.io/docs/latest/",
    license: "RSALv2 / SSPLv1",
    sectionTitle: "Redis Pub/Sub Messaging Pattern",
    content: "Redis provides lightweight Publish/Subscribe messaging where publishers push messages to designated channels without knowing subscriber topologies. Subscribers receive messages in real time. Pub/Sub messages are at-most-once delivery (fire-and-forget); if a subscriber is disconnected when a message is published, the message is not retained unless Redis Streams with consumer groups are utilized instead."
  },
  {
    techSlug: "redis",
    sourceName: "Redis Official Documentation",
    sourceUrl: "https://redis.io/docs/latest/",
    license: "RSALv2 / SSPLv1",
    sectionTitle: "Redis Persistence: RDB Snapshots vs Append-Only File (AOF)",
    content: "While Redis operates primarily in memory, durability is achieved through two persistence mechanisms: RDB (Redis Database) snapshots and AOF (Append Only File) logs. RDB forks a background child process to write point-in-time binary disk snapshots at configured intervals. AOF records every write command to a sequential append-only log file with configurable fsync policies (always, everysec, or no), offering minimal data loss windows at the cost of disk write throughput."
  }
];

async function ingest() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection("doc_chunks");

    console.log(`[Ingest] Processing ${docChunks.length} documentation chunks with local Transformers.js...`);

    let index = 0;
    for (const chunk of docChunks) {
      console.log(`[Ingest] Embedding (${index + 1}/${docChunks.length}): [${chunk.techSlug}] ${chunk.sectionTitle}...`);
      const embedding = await getEmbedding(chunk.content);

      await collection.updateOne(
        { techSlug: chunk.techSlug, sectionTitle: chunk.sectionTitle },
        {
          $set: {
            techSlug: chunk.techSlug,
            sourceName: chunk.sourceName,
            sourceUrl: chunk.sourceUrl,
            license: chunk.license,
            sectionTitle: chunk.sectionTitle,
            content: chunk.content,
            embedding: embedding,
            chunkIndex: index,
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      index++;
    }

    console.log(`[Ingest] Successfully ingested and indexed ${index} document chunks into MongoDB!`);
  } catch (err) {
    console.error("[Ingest] Ingestion failed:", err.message);
  } finally {
    await client.close();
  }
}

ingest();

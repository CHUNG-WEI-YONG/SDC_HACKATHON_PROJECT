const apiUrl = (process.env.LIGGY_API_URL || "http://localhost:3001").replace(/\/$/, "");

const levels = {
  light: { workers: 5, requestsPerWorker: 20 },
  medium: { workers: 20, requestsPerWorker: 50 },
  stress: { workers: 50, requestsPerWorker: 100 },
};

const levelName = (process.argv[2] || "light").toLowerCase();
const level = levels[levelName];

if (!level) {
  console.error(`Choose a level: ${Object.keys(levels).join(", ")}`);
  process.exit(2);
}

const sampleTimes = [];
let failures = 0;
const startedAt = performance.now();

async function worker() {
  for (let i = 0; i < level.requestsPerWorker; i += 1) {
    const requestStartedAt = performance.now();
    try {
      const response = await fetch(`${apiUrl}/api/health`, {
        signal: AbortSignal.timeout(10000),
      });
      await response.arrayBuffer();
      if (!response.ok) failures += 1;
    } catch (error) {
      failures += 1;
      if (failures === 1) console.error(`First request failed: ${error.message}`);
    } finally {
      sampleTimes.push(performance.now() - requestStartedAt);
    }
  }
}

console.log(`Running ${levelName} load level against ${apiUrl}/api/health`);
console.log(`${level.workers} concurrent workers; ${level.requestsPerWorker} requests per worker.`);
console.log("This checks the lightweight health endpoint only; it does not create invoices or call the AI provider.");

await Promise.all(Array.from({ length: level.workers }, () => worker()));

const elapsedSeconds = (performance.now() - startedAt) / 1000;
sampleTimes.sort((a, b) => a - b);
const percentile = (value) => sampleTimes[Math.min(sampleTimes.length - 1, Math.ceil(value * sampleTimes.length) - 1)] || 0;
const total = level.workers * level.requestsPerWorker;
const requestsPerSecond = total / elapsedSeconds;

console.log(`Completed: ${total - failures}/${total} successful`);
console.log(`Duration: ${elapsedSeconds.toFixed(2)}s`);
console.log(`Throughput: ${requestsPerSecond.toFixed(1)} requests/second`);
console.log(`Latency: p50 ${percentile(0.50).toFixed(1)}ms | p95 ${percentile(0.95).toFixed(1)}ms | max ${Math.max(...sampleTimes).toFixed(1)}ms`);
if (failures) {
  console.error(`FAIL: ${failures} request(s) failed.`);
  process.exitCode = 1;
} else if (percentile(0.95) > 1000) {
  console.warn("WARNING: p95 exceeded 1 second. Repeat the run and check the backend machine load before drawing a conclusion.");
} else {
  console.log("PASS: all health-check requests succeeded. Compare results across levels on the same machine.");
}

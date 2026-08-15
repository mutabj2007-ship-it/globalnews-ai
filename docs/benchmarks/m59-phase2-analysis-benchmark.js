/**
 * M59 Scale Readiness — Phase 2 benchmark harness.
 *
 * Covers POST /analysis/news under 5-way concurrency, for both
 * identical and distinct simultaneous requests. Uses only Node's
 * built-in fetch — no new dependency.
 *
 * Safety: assumes the backend under test is already running with
 * OPENAI_API_KEY unset/unusable, so the mock/development analysis
 * provider is active — this selection is boot-time deterministic (see
 * docs/milestones/M59_SCALE_READINESS_REPORT.md section G), so no
 * request volume from this script can cause a real OpenAI call once
 * the backend process has started under that condition. This script
 * makes no OpenAI/GNews calls itself.
 *
 * Not part of the application build — a documentation/audit artifact
 * only, kept under docs/benchmarks/, never imported by application code.
 */

const BASE_URL = process.env.M59_BASE_URL || 'http://localhost:4000';
const CONCURRENCY = 5;

// Same 60-second sliding-window throttle reasoning as Phase 1 — waited
// in full before EACH analysis batch below, since POST /analysis/news
// carries its own stricter route-level throttle (5 requests / 60s) in
// addition to the global default.
const THROTTLE_RESET_WAIT_MS = 65000;

// Analysis requests can legitimately take longer than a typical read
// endpoint (real providers would involve genuine network/AI latency;
// even the mock path does deliberate, realistic work). 30 seconds
// comfortably exceeds the observed local latencies and leaves headroom
// without waiting indefinitely if something actually hangs.
const PER_REQUEST_TIMEOUT_MS = 30000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function timedAnalysisRequest(body) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/analysis/news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      throttled: response.status === 429,
      transportFailure: false,
      ms: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      throttled: false,
      transportFailure: true,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function percentile(sortedLatencies, p) {
  const index = Math.min(sortedLatencies.length - 1, Math.floor(sortedLatencies.length * p));
  return sortedLatencies[index];
}

async function runAnalysisBatch(label, requestBodies) {
  const batchStartedAt = Date.now();
  const results = await Promise.all(requestBodies.map((body) => timedAnalysisRequest(body)));
  const elapsedMs = Date.now() - batchStartedAt;

  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const successes = results.filter((r) => r.ok).length;
  const throttled = results.filter((r) => r.throttled).length;
  const transportFailures = results.filter((r) => r.transportFailure).length;
  const otherHttpFailures = results.filter((r) => !r.ok && !r.throttled && !r.transportFailure).length;

  const statusDistribution = {};
  for (const r of results) {
    statusDistribution[r.status] = (statusDistribution[r.status] || 0) + 1;
  }

  const average = latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length;
  const requestsPerSecond = requestBodies.length / (elapsedMs / 1000);

  console.log(`\n=== ${label} — ${requestBodies.length} concurrent ===`);
  console.log('Attempted:', requestBodies.length);
  console.log('HTTP 2xx:', successes);
  console.log('HTTP 429:', throttled);
  console.log('Other HTTP failures:', otherHttpFailures);
  console.log('Transport failures:', transportFailures);
  console.log('Status distribution:', statusDistribution);
  console.log('Elapsed:', elapsedMs.toFixed(2), 'ms');
  console.log('Average:', average.toFixed(2), 'ms');
  console.log('p50:', percentile(latencies, 0.5).toFixed(2), 'ms');
  console.log('p95:', percentile(latencies, 0.95).toFixed(2), 'ms');
  console.log('Maximum:', latencies[latencies.length - 1].toFixed(2), 'ms');
  console.log('Requests/sec:', requestsPerSecond.toFixed(2));

  if (throttled > 0) {
    console.log(`NOTE: THROTTLE ACTIVATED AS DESIGNED for ${throttled} request(s) — not a capacity failure.`);
  }

  return results;
}

async function main() {
  console.log('M59 Phase 2 analysis benchmark — target:', BASE_URL);

  console.log(`\nWaiting ${THROTTLE_RESET_WAIT_MS / 1000}s for a full throttle-window reset before the identical-request batch...`);
  await sleep(THROTTLE_RESET_WAIT_MS);

  // Five IDENTICAL requests — the same query text on every request.
  // If in-flight deduplication is working, only one of these five
  // should trigger genuine analysis work; the rest join it.
  const identicalBodies = Array.from({ length: CONCURRENCY }, () => ({
    query: 'benchmark identical test query',
  }));
  await runAnalysisBatch('5 IDENTICAL ANALYSIS REQUESTS', identicalBodies);

  console.log(`\nWaiting ${THROTTLE_RESET_WAIT_MS / 1000}s for a full throttle-window reset before the distinct-request batch...`);
  await sleep(THROTTLE_RESET_WAIT_MS);

  // Five DISTINCT requests — guaranteed-unique query text per request,
  // so none of them can share a cache/in-flight key with another.
  const distinctBodies = Array.from({ length: CONCURRENCY }, (_, index) => ({
    query: `benchmark distinct test query ${index}-${Date.now()}-${Math.random()}`,
  }));
  await runAnalysisBatch('5 DISTINCT ANALYSIS REQUESTS', distinctBodies);

  console.log('\nPhase 2 complete.');
}

main().catch((error) => {
  console.error('Phase 2 benchmark failed:', error);
  process.exit(1);
});

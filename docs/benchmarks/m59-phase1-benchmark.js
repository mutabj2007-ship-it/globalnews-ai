/**
 * M59 Scale Readiness — Phase 1 benchmark harness.
 *
 * Covers /health, /news/top-headlines, and /news/search under 5-way
 * concurrency. Uses only Node's built-in fetch — no new dependency.
 *
 * Safety: this script performs NO configuration of its own. It assumes
 * the backend under test is already running with a development
 * environment where GNEWS_API_KEY is unset/unusable (MockNewsProvider
 * active) and NODE_ENV is not "production" — see
 * docs/milestones/M59_SCALE_READINESS_REPORT.md section G for the
 * exact conditions this was actually run under. This script makes no
 * OpenAI/GNews calls itself; whether the backend does depends entirely
 * on that backend's own provider selection, not on anything here.
 *
 * Not part of the application build — a documentation/audit artifact
 * only, kept under docs/benchmarks/, never imported by application code.
 */

const BASE_URL = process.env.M59_BASE_URL || 'http://localhost:4000';
const CONCURRENCY = 5;

// Milestone #56's analysis-route throttle (5 requests / 60s) and the
// global default throttle (20 requests / 60s) both use a 60-second
// sliding window. Waiting 65 seconds guarantees a full throttle-window
// reset before this script's first request, so nothing left over from
// an earlier run/manual testing against the same backend can cause a
// spurious 429 anywhere in this run.
const THROTTLE_RESET_WAIT_MS = 65000;

// Milestone #59 correction — a short pause between each of this
// phase's three batches, matching the actual benchmark procedure this
// script archives. This is a much smaller wait than
// THROTTLE_RESET_WAIT_MS and serves a different purpose: it is not
// meant to reset the 60-second throttle window (15 total requests
// across all three batches stays well under the global 20/60s limit
// regardless), it simply separates the batches in time for cleaner,
// more legible individual measurements.
const INTER_BATCH_WAIT_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Times one request and classifies its outcome without throwing.
 * A network-level failure (connection refused, DNS failure, etc.) is
 * recorded as a transport failure, distinct from an HTTP-level
 * non-2xx response — the two must never be conflated when interpreting
 * results.
 */
async function timedRequest(makeRequest) {
  const startedAt = Date.now();
  try {
    const response = await makeRequest();
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
  }
}

function percentile(sortedLatencies, p) {
  const index = Math.min(sortedLatencies.length - 1, Math.floor(sortedLatencies.length * p));
  return sortedLatencies[index];
}

async function runConcurrentBatch(label, count, makeRequest) {
  const batchStartedAt = Date.now();
  const results = await Promise.all(Array.from({ length: count }, () => timedRequest(makeRequest)));
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
  const requestsPerSecond = count / (elapsedMs / 1000);

  console.log(`\n=== ${label} — ${count} concurrent ===`);
  console.log('Attempted:', count);
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
  console.log('M59 Phase 1 benchmark — target:', BASE_URL);

  // Milestone #59 correction — the throttle-window reset wait runs
  // FIRST, before anything else, so any earlier activity against this
  // backend (from a prior script run, manual testing, etc.) cannot
  // cause a spurious 429 anywhere in this run. This must not be
  // confused with an inter-batch wait: it exists purely to guarantee
  // a clean starting state.
  console.log(`Waiting ${THROTTLE_RESET_WAIT_MS / 1000}s to clear any previous throttle window before starting...`);
  await sleep(THROTTLE_RESET_WAIT_MS);

  // Preflight: a single request confirming the backend is reachable
  // before committing to the timed concurrent batches below.
  console.log('\nPreflight /health check...');
  const preflight = await timedRequest(() => fetch(`${BASE_URL}/health`));
  if (!preflight.ok) {
    console.error('Preflight failed — aborting benchmark.', preflight);
    process.exit(1);
  }
  console.log('Preflight OK (', preflight.ms.toFixed(2), 'ms ).');

  await runConcurrentBatch('HEALTH', CONCURRENCY, () => fetch(`${BASE_URL}/health`));

  console.log(`\nWaiting ${INTER_BATCH_WAIT_MS / 1000}s before the next batch...`);
  await sleep(INTER_BATCH_WAIT_MS);

  await runConcurrentBatch('TOP HEADLINES — MOCK PROVIDER', CONCURRENCY, () =>
    fetch(`${BASE_URL}/news/top-headlines?limit=1`),
  );

  console.log(`\nWaiting ${INTER_BATCH_WAIT_MS / 1000}s before the next batch...`);
  await sleep(INTER_BATCH_WAIT_MS);

  await runConcurrentBatch('NEWS SEARCH — MOCK PROVIDER', CONCURRENCY, () =>
    fetch(`${BASE_URL}/news/search?q=Rwanda&limit=1`),
  );

  console.log('\nPhase 1 complete.');
}

main().catch((error) => {
  console.error('Phase 1 benchmark failed:', error);
  process.exit(1);
});

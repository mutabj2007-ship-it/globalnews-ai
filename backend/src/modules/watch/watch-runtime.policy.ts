/** CTO HOLD: source-controlled; no environment variable can activate this runtime. */
export const WATCH_RUNTIME_ACTIVE = false;
export const WATCH_LIMITS = Object.freeze({
  subscriptionsPerUser: 20,
  batchSize: 20,
  leaseSeconds: 60,
  retrySeconds: 60,
  maxAttempts: 3,
  maxDailyRuns: 24,
  maxDailyAttempts: 48,
  maxEvidence: 100,
  minIntervalSeconds: 3600,
  maxIntervalSeconds: 604800,
});

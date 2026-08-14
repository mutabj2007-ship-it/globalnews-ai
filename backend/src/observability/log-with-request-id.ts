import type { Logger } from '@nestjs/common';
import { getCurrentRequestId } from './request-context';

/**
 * Milestone #55 correction — a raw Error object passed straight
 * through to NestJS's Logger (the original design) prints that
 * error's full stack trace by default. A stack trace is a much wider
 * disclosure surface than M55 needs, and for an error that escapes
 * this codebase's own classified provider error types (OpenAiAnalysisError,
 * GNewsProviderError — both already tested elsewhere to never embed a
 * raw key) — e.g. a raw, unclassified database driver failure — the
 * underlying message itself can embed a full connection string
 * including its embedded username:password (the exact shape
 * DATABASE_URL and similar connection strings always take).
 *
 * This function is the one place that risk is closed: it returns only
 * `error.message` (never `.stack`), with any embedded
 * `scheme://user:password@host` credential pattern redacted. Real
 * failure classification is preserved — the message still says WHAT
 * failed (e.g. "Can't reach database server at ...") — only the
 * embedded credential itself, and the stack trace, are removed.
 */
function sanitizeErrorForLogging(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const CREDENTIAL_URL_PATTERN = /:\/\/[^\s:@/]+:[^\s@/]+@/g;
  // Milestone #55 correction — also redact common secret-VALUE shapes
  // that are NOT embedded in a URL: "token=...", "key=...",
  // "password=...", "secret=...", an "Authorization: Bearer ..."
  // header value, or an OpenAI-style "sk-..." key appearing anywhere
  // in the message — defense-in-depth for a raw, unclassified error
  // (this codebase's own OpenAiAnalysisError/GNewsProviderError
  // classes are already tested elsewhere to never embed a real key,
  // but this function protects the case something outside that
  // classified error hierarchy reaches this logging layer).
  const SECRET_VALUE_PATTERN = /((?:token|key|password|secret|session|cookie)\s*[:=]\s*)\S+/gi;
  const BEARER_PATTERN = /(Bearer\s+)\S+/gi;
  const OPENAI_KEY_PATTERN = /sk-[A-Za-z0-9_-]{10,}/g;

  return error.message
    .replace(CREDENTIAL_URL_PATTERN, '://[REDACTED]@')
    .replace(SECRET_VALUE_PATTERN, '$1[REDACTED]')
    .replace(BEARER_PATTERN, '$1[REDACTED]')
    .replace(OPENAI_KEY_PATTERN, '[REDACTED]');
}

/**
 * Milestone #55 — the smallest mechanism that makes an existing
 * Logger call ACTUALLY EMIT the current request ID, rather than
 * merely making the ID "available" via AsyncLocalStorage. Deliberately
 * NOT a replacement for NestJS's Logger — every call site keeps its
 * own existing `new Logger(ClassName.name)` instance and passes it in
 * here; this only prefixes the message with the correlation ID when
 * one is active (e.g. every request handled by LoggingInterceptor),
 * and leaves the message completely unchanged when none is active
 * (e.g. a log emitted outside any HTTP request, such as application
 * startup, or from a directly-instantiated unit test).
 *
 * Applied at a small, enumerated set of call sites confirmed by direct
 * file inspection during M55 planning — not a blanket replacement of
 * every Logger call in the codebase.
 *
 * The optional trailing `error` parameter (narrowed from the
 * original design's `...args: unknown[]` — every existing call site
 * already passes at most one such argument, always Error-shaped or
 * undefined, so this is a type-signature tightening, not a call-site
 * behavior change) is never forwarded to the logger as a raw object.
 * It is always sanitized first — see sanitizeErrorForLogging().
 */
export function logWithRequestId(
  logger: Logger,
  level: 'log' | 'warn' | 'error' | 'debug',
  message: string,
  error?: unknown,
): void {
  const requestId = getCurrentRequestId();
  const prefixed = requestId ? `[${requestId}] ${message}` : message;

  const sanitized = sanitizeErrorForLogging(error);
  logger[level](sanitized ? `${prefixed} (${sanitized})` : prefixed);
}

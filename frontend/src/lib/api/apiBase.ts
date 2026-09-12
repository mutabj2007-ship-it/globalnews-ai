/**
 * Milestone R2 - central, execution-context-aware backend base URL
 * resolution.
 *
 * Before this module existed, every frontend API client read
 * `process.env.NEXT_PUBLIC_API_URL` directly. That is correct for
 * browser-executed code, but wrong for code that executes on the server
 * (Next.js Server Components and route handlers): in a containerised
 * deployment the server-side runtime lives *inside* the frontend
 * container, where `localhost` resolves to the frontend itself rather
 * than to the backend, so a server-side request to the browser's public
 * URL fails at the TCP level.
 *
 * Resolution contract:
 *
 *   SERVER  : SERVER_INTERNAL_API_URL ?? NEXT_PUBLIC_API_URL ?? default
 *   BROWSER : NEXT_PUBLIC_API_URL ?? default
 *
 * `SERVER_INTERNAL_API_URL` is deliberately NOT a `NEXT_PUBLIC_*`
 * variable and is deliberately read only inside the server branch, so it
 * is never inlined into the client bundle and can never be returned to
 * browser-executed code. Browser code keeps resolving to exactly the
 * value it resolved to before this change.
 *
 * The final fallback is unchanged from the value these clients already
 * used, so local non-Docker development behaves identically.
 */

export const DEFAULT_API_BASE_URL = 'http://localhost:4000';

/**
 * True when this code is executing outside a browser. `window` is the
 * standard Next.js execution-context discriminator: absent in the
 * Node.js server runtime, present in every browser runtime.
 */
export function isServerExecutionContext(): boolean {
  return typeof window === 'undefined';
}

/**
 * Resolves the backend base URL for the *current* execution context.
 *
 * Deliberately evaluated per call rather than captured once at module
 * scope: the server value arrives as a container runtime environment
 * variable, and module evaluation can happen earlier than that (Next.js
 * evaluates route modules during the build when prerendering).
 */
export function resolveApiBaseUrl(): string {
  if (isServerExecutionContext()) {
    return (
      process.env.SERVER_INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL
    );
  }

  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
}

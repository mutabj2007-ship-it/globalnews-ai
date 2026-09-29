/**
 * STANDALONE PUBLIC BETA CONVERGENCE R1 — what `/` serves.
 *
 * The released product is Ask GlobalNewsAI, so on this candidate `/` IS the standalone Ask
 * entry surface (G's shell) — no platform NavBar, no Today, no Map navigation, no My
 * Intelligence, no specialist dashboards. The wider-platform Home stays in the tree
 * untouched and is restored ONLY by an explicit server-side setting, so Alpha may keep
 * developing the wider product without a code change:
 *
 *   GNA_PUBLIC_ROOT=platform   → the wider-platform Home at `/`
 *   anything else / unset      → standalone Ask at `/` (the Public Beta default)
 *
 * Server-only (never NEXT_PUBLIC_): read per request by the root page and the root layout.
 */
export function standaloneAskRoot(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (env.GNA_PUBLIC_ROOT ?? '').trim().toLowerCase() !== 'platform';
}

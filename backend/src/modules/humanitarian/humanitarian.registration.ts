import type { DynamicModule, Provider } from '@nestjs/common';

import { HumanitarianModule, type HumanitarianBootOptions } from './humanitarian-boot';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE COMPOSITION DECISION — WHETHER HUMANITARIAN RUNS AT ALL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-BOOT-INTAKE-R1 · part B.
 *
 * `HumanitarianModule.forRoot` needs a `GovernedAuthorityStore`, and G's R1.2 is explicit
 * about not supplying one: *"reading the authority store needs a credential this lane has
 * no authority to hand out, and a default store is how a boot path ends up reading
 * something nobody chose."* That is correct, and it leaves exactly one decision for the
 * composition root to make.
 *
 * ── WHY THIS IS NOT AN UNCONDITIONAL IMPORT ───────────────────────────────
 *
 * `hum_authority` is a separate schema with a separate owner, created by
 * `sql/gx14-authority-store.sql`, and it exists in NO current database — not dev, not
 * CI, not Alpha. Importing the module unconditionally would make every backend start
 * read a schema that is not there, and the process fails closed by design, so the whole
 * backend would stop booting everywhere. A security control that takes the product down
 * in every environment it was not provisioned for gets reverted within the day, and the
 * revert removes the control.
 *
 * ── THE RULE, AND THE THING IT REFUSES TO BE ──────────────────────────────
 *
 * Two states, and no third:
 *
 *   NOT PROVISIONED   no store binding is supplied, the module is not imported, and
 *                     HUMANITARIAN DOES NOT RUN. No authority, no intake, no reader
 *                     path — `currentProtectionAuthority()` throws for anyone who asks.
 *                     Nothing is served unprotected, because nothing is served.
 *
 *   PROVISIONED       a store binding is supplied, the module is imported, and boot
 *                     VALIDATES. Any failure — drift, empty registry, unreachable store
 *                     — refuses the start.
 *
 * The state this deliberately cannot express is "provisioned, validation failed, carry
 * on". That is the state GA-44 exists to forbid, and the way it usually arrives is a
 * boolean that degrades instead of refusing.
 *
 * ── AND IT IS NOT AN ENVIRONMENT FLAG ─────────────────────────────────────
 *
 * E1 forbade a flag that turns provider execution on, and G's boot file asserts it reads
 * no environment. This reads none either: provisioning is expressed by SUPPLYING A
 * PROVIDER, which is a code change in a reviewed file, not a variable somebody exports
 * on a box. Provider acquisition stays off regardless — `COPERNICUS_PRODUCER_ENABLED` is
 * the literal `false`, and boot refuses to start if it ever is not.
 */

export interface HumanitarianProvisioning {
  /** Bound to the real governed-rows reader. Its absence is the "not provisioned" state. */
  readonly store: Provider;
  readonly options: HumanitarianBootOptions;
}

/**
 * What `AppModule` spreads into its `imports`.
 *
 * Returns an EMPTY ARRAY when unprovisioned rather than a module that does nothing —
 * because a module that does nothing still appears in the graph, still looks registered
 * to anyone reading it, and is the thing somebody later "fixes" by giving it a default
 * store.
 */
export function humanitarianModuleImports(
  provisioning?: HumanitarianProvisioning,
): DynamicModule[] {
  if (provisioning === undefined) return [];
  return [HumanitarianModule.forRoot(provisioning)];
}

/**
 * THE PROVISIONING THIS DEPLOYMENT HAS.
 *
 * `undefined`, and it is a deliberate, reviewable statement rather than an omission:
 * no database in this lineage has the `hum_authority` schema, so there is no governed
 * store to read. Applying that schema is a DBA action against a real database, which is
 * outside this task by ruling — Production HOLD, no migration deployment.
 *
 * Binding it is one object literal, in this file, once the schema exists:
 *
 *     export const HUMANITARIAN_PROVISIONING: HumanitarianProvisioning | undefined = {
 *       store: { provide: HUMANITARIAN_AUTHORITY_STORE, useClass: PostgresGovernedAuthorityStore },
 *       options: { epoch: 1, loadedAt: new Date().toISOString() },
 *     };
 *
 * Until then Humanitarian does not run, which is the correct behaviour for a capability
 * whose authority store does not exist — and is distinct from running it with an empty
 * authority, which GA-44 refuses precisely because an empty dark set protects nothing
 * while looking exactly like one that protects everything.
 */
export const HUMANITARIAN_PROVISIONING: HumanitarianProvisioning | undefined = undefined;

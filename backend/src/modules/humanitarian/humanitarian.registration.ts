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
 * `sql/gx14-authority-store.sql`. This source configuration supplies no reviewed store
 * binding. Importing the module unconditionally would make every backend start
 * read an unverified store, and the process fails closed by design, so the whole
 * backend would stop booting everywhere. A security control that takes the product down
 * in every environment it was not provisioned for gets reverted within the day, and the
 * revert removes the control.
 *
 * ── THE RULE, AND THE THING IT REFUSES TO BE ──────────────────────────────
 *
 * Two states, and no third:
 *
 *   NOT PROVISIONED   no store binding is supplied, the module is not imported, and
 *                     the governed capability does not run: no authority, intake or protected reader
 *                     path. The independent public absence-only route remains available.
 *                     No protected observations are served.
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
 * No reviewed governed store binding is configured in this deployment. Do not infer
 * database readiness from a provider declaration or set a data-ready flag here.
 * A reviewed binding must pass boot validation before the capability is initialized.
 *
 * The independent public module reports absence without initializing this capability.
 * Successful authority boot alone proves neither retained capture admission nor an
 * observation store. Source approval, provenance, chronology and revisions are separate.
 */
export const HUMANITARIAN_PROVISIONING: HumanitarianProvisioning | undefined = undefined;

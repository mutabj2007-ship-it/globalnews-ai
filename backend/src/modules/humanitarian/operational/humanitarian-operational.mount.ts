/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE MOUNT — AND THE CONDITION IT IS ALLOWED UNDER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * HUMANITARIAN-F-OPS-R2. The contract: *"Mount/register the operational read
 * module only if it cannot activate acquisition."*
 *
 * That is a conditional permission, so the condition is CHECKED HERE rather
 * than argued in a comment. `humanitarianOperationalImports()` inspects the
 * module it is about to mount and returns an EMPTY ARRAY when the module is not
 * the read-only shape this lane reviewed.
 *
 * ── WHY IT RETURNS [] RATHER THAN THROWING ────────────────────────────────
 *
 * The humanitarian registration file already paid for this lesson: *"a security
 * control that takes the product down in every environment it was not
 * provisioned for gets reverted within the day, and the revert removes the
 * control."* GA-44 refuses the boot because a mis-provisioned authority store
 * would serve protected data wrongly. Nothing comparable is true of an operator
 * status page: its ABSENCE is the safe direction. So a module that fails the
 * check does not reach the application, and the application still starts.
 *
 * `operationalMountDecision()` keeps the reason retrievable, because a control
 * that silently does nothing is the failure this whole surface exists to
 * prevent. A refused mount is a stated refusal, not a missing route.
 *
 * ── WHAT "CANNOT ACTIVATE ACQUISITION" IS CHECKED AS ──────────────────────
 *
 * Four properties, each the thing that would have to be true for acquisition to
 * become reachable through this module:
 *
 *   1. ITS IMPORTS. Acquisition arrives by dependency. The allowlist holds the
 *      two security modules the guard chain needs and nothing else, so a
 *      producer, intake, Prisma or HTTP module appearing in `imports` refuses
 *      the mount. Compared by name against a frozen list rather than by
 *      identity, so a renamed or re-exported module cannot slip through.
 *   2. ITS PROVIDERS AND CONTROLLERS. Exactly one of each, the reviewed pair.
 *      A second provider is a second thing that could hold a client.
 *   3. ITS ROUTES. Every handler must be a GET. This is checked against Nest's
 *      own route metadata, not against the source text, so a decorator added by
 *      a mixin or a base class is seen too.
 *   4. ITS EXPORTS. None. A module that exports its service lets another module
 *      compose it into a write path.
 *
 * None of this makes acquisition possible-but-forbidden; it keeps the mounted
 * shape identical to the one `humanitarianOperational.spec.ts` proves cannot
 * reach the wire. The spec's `fetch`-at-the-wire measurement is the behavioural
 * half; this is the half that still holds after a future edit.
 *
 * NOT AN ACTIVATION CONTROL. This decides whether a READ ROUTE exists. It
 * cannot clear a source, cannot change E1's verdict, and is not an
 * `OperationalSwitch` — there is no row, no toggle and no runtime input. The
 * decision is a property of the code, computed at module definition.
 */

import type { DynamicModule, Type } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { HumanitarianOperationalController } from './humanitarian-operational.controller';
import { HumanitarianOperationalModule } from './humanitarian-operational.module';
import { HumanitarianOperationalService } from './humanitarian-operational.service';

/** The only modules a read-only admin status surface may depend on. */
export const OPERATIONAL_MOUNT_ALLOWED_IMPORTS: readonly string[] = Object.freeze([
  'AuthModule',
  'AdminModule',
]);

export interface OperationalMountDecision {
  readonly mounted: boolean;
  /** Null when mounted. Never an empty string — a blank reason is not a reason. */
  readonly refusedBecause: string | null;
}

const nameOf = (value: unknown): string => {
  if (typeof value === 'function') return value.name || '(anonymous)';
  if (value !== null && typeof value === 'object') {
    const dynamic = value as { module?: { name?: string } };
    if (typeof dynamic.module === 'function') return (dynamic.module as Type).name;
    if (dynamic.module?.name !== undefined) return dynamic.module.name;
    return '(dynamic module)';
  }
  return String(value);
};

const metadata = (key: string, target: unknown): unknown[] => {
  const value = Reflect.getMetadata(key, target as object);
  return Array.isArray(value) ? (value as unknown[]) : [];
};

/**
 * Every reason the module is not the reviewed read-only shape, or an empty list.
 *
 * Returns ALL findings rather than the first, so a reviewer reading a refusal
 * sees the whole divergence instead of fixing one and discovering the next.
 */
export function operationalMountViolations(
  moduleClass: unknown = HumanitarianOperationalModule,
): readonly string[] {
  const found: string[] = [];

  const imports = metadata(MODULE_METADATA.IMPORTS, moduleClass).map(nameOf);
  for (const imported of imports) {
    if (OPERATIONAL_MOUNT_ALLOWED_IMPORTS.indexOf(imported) === -1) {
      found.push(
        `IMPORT_NOT_ALLOWED: '${imported}'. Acquisition arrives by dependency. Only ` +
          `${OPERATIONAL_MOUNT_ALLOWED_IMPORTS.join(' and ')} — the guard chain — may be imported ` +
          'by a surface that is allowed to mount unreviewed.',
      );
    }
  }

  const providers = metadata(MODULE_METADATA.PROVIDERS, moduleClass);
  if (providers.length !== 1 || providers[0] !== HumanitarianOperationalService) {
    found.push(
      `PROVIDERS_NOT_THE_REVIEWED_ONE: [${providers.map(nameOf).join(', ')}]. A second provider is ` +
        'a second thing that could hold a client.',
    );
  }

  const controllers = metadata(MODULE_METADATA.CONTROLLERS, moduleClass);
  if (controllers.length !== 1 || controllers[0] !== HumanitarianOperationalController) {
    found.push(`CONTROLLERS_NOT_THE_REVIEWED_ONE: [${controllers.map(nameOf).join(', ')}].`);
  }

  const exported = metadata(MODULE_METADATA.EXPORTS, moduleClass);
  if (exported.length !== 0) {
    found.push(
      `EXPORTS_NOT_EMPTY: [${exported.map(nameOf).join(', ')}]. An exported service can be ` +
        'composed into another module’s write path, which is how a read surface stops being one.',
    );
  }

  for (const controller of controllers) {
    if (typeof controller !== 'function') continue;
    const proto = (controller as Type).prototype as Record<string, unknown>;
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;
      const handler = proto[key];
      if (typeof handler !== 'function') continue;
      if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
      const verb = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      if (verb !== RequestMethod.GET) {
        found.push(
          `NON_GET_ROUTE: ${nameOf(controller)}.${key} is declared as ` +
            `${RequestMethod[verb as number] ?? String(verb)}. A mutation verb on this surface is a ` +
            'write path into Humanitarian operations, and the mount condition is that there is none.',
        );
      }
    }
  }

  return Object.freeze(found);
}

export function operationalMountDecision(
  moduleClass: unknown = HumanitarianOperationalModule,
): OperationalMountDecision {
  const violations = operationalMountViolations(moduleClass);
  if (violations.length === 0) return Object.freeze({ mounted: true, refusedBecause: null });
  return Object.freeze({
    mounted: false,
    refusedBecause:
      'HUMANITARIAN_OPERATIONAL_MOUNT_REFUSED — the module is not the reviewed read-only shape, ' +
      `so it is not registered and the route does not exist. ${violations.join(' | ')}`,
  });
}

/**
 * What `AppModule` spreads into its `imports`.
 *
 * SPREAD, NOT IMPORTED DIRECTLY — the same technique `humanitarianModuleImports`
 * uses, and for the same reason: the state "registered but should not have been"
 * is not expressible, because an unsatisfied condition produces no module at all
 * rather than a module that is present and inert.
 */
export function humanitarianOperationalImports(): Array<Type | DynamicModule> {
  return operationalMountDecision().mounted ? [HumanitarianOperationalModule] : [];
}

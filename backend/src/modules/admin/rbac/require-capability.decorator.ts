import { SetMetadata } from '@nestjs/common';
import type { Capability } from './capabilities';

/**
 * F1.a — route authorization metadata read by AdminGuard.
 *
 * THE FAIL-CLOSED RULE, and the reason there are two decorators
 * instead of one optional-argument decorator:
 *
 *   metadata ABSENT            -> AdminGuard DENIES (403)
 *   metadata present, empty    -> any authenticated administrator
 *   metadata present, non-empty-> administrator must hold every listed capability
 *
 * A forgotten decorator is therefore indistinguishable from a denial,
 * never from a grant. `@AdminOnly()` is the explicit, greppable way to
 * say "any admin role is sufficient here" — it can never be confused
 * with having forgotten to annotate the route, because the metadata
 * key is present.
 */
export const ADMIN_CAPABILITY_METADATA = 'admin:required-capabilities';

/** Require every listed capability. */
export const RequireCapability = (
  ...capabilities: Capability[]
): MethodDecorator & ClassDecorator => SetMetadata(ADMIN_CAPABILITY_METADATA, capabilities);

/** Any authenticated administrator, with no specific capability. */
export const AdminOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ADMIN_CAPABILITY_METADATA, [] as Capability[]);

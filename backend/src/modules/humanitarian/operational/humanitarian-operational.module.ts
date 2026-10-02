import { Module } from '@nestjs/common';
import { AdminModule } from '../../admin/admin.module';
import { AuthModule } from '../../auth/auth.module';
import { HumanitarianOperationalController } from './humanitarian-operational.controller';
import { HumanitarianOperationalService } from './humanitarian-operational.service';

/**
 * HUMANITARIAN OPERATIONAL STATUS — REGISTERED IN `app.module.ts`: YES, UNDER A
 * CHECKED CONDITION (R2).
 *
 * R1 left this module wired nowhere, because R1's own reasoning was that putting
 * a route on the admin surface was a step it had not been authorised to take.
 * R2 authorises it and states the condition: *"Mount/register the operational
 * read module only if it cannot activate acquisition."*
 *
 * So the mount is not an entry added to an array. `humanitarianOperationalImports()`
 * in `humanitarian-operational.mount.ts` inspects this module's own Nest metadata
 * — imports, providers, controllers, exports and the HTTP verb of every route —
 * and yields nothing at all if the shape is not the reviewed read-only one. The
 * absence of this status page is safe; a status page with a write path is not.
 *
 * `humanitarianOperational.spec.ts` asserts the registration, and
 * `humanitarianOperationalMount.spec.ts` asserts that a tampered module is
 * refused, with the real module as the positive control.
 *
 * IT IMPORTS NO DATA MODULE. No Prisma, no HTTP, no humanitarian intake or
 * producer module. `AuthModule` supplies `RequireAuthGuard`, and `AdminModule`
 * supplies `AdminGuard`, `AdminPlatformEnabledGuard` and the `AdminService` the
 * first depends on — REUSED, not re-implemented. `admin.module.ts` already
 * exports exactly these three so that the admin support controller is
 * "authorized by THIS guard rather than by a second copy of the admin security
 * model living somewhere else"; this surface takes the same route.
 *
 * Importing `AdminModule` brings no write path: this module contributes one
 * `@Get`, and nothing here can reach an admin mutation.
 */
@Module({
  imports: [AuthModule, AdminModule],
  controllers: [HumanitarianOperationalController],
  providers: [HumanitarianOperationalService],
})
export class HumanitarianOperationalModule {}

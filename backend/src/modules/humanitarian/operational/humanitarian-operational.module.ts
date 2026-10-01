import { Module } from '@nestjs/common';
import { AdminModule } from '../../admin/admin.module';
import { AuthModule } from '../../auth/auth.module';
import { HumanitarianOperationalController } from './humanitarian-operational.controller';
import { HumanitarianOperationalService } from './humanitarian-operational.service';

/**
 * HUMANITARIAN OPERATIONAL STATUS — REGISTERED IN `app.module.ts`: NO.
 *
 * The module compiles and is wired nowhere, following the precedent this
 * repository already sets for work awaiting review. Registering it would put a
 * new route on the deployed admin surface, which is activation, and the brief's
 * final marker asks for a REVIEW rather than a release.
 *
 * `humanitarianOperational.spec.ts` asserts the absence against `app.module.ts`
 * with a positive control that the same sweep sees a module that IS registered.
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

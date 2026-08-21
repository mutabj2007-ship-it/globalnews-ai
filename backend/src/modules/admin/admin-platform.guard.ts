import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ADMIN_PLATFORM_ENABLED_ENV, isAdminPlatformEnabled } from './admin-platform.config';

/**
 * F1.a — the kill switch, enforced as the FIRST guard on every admin
 * route, ahead of RequireAuthGuard.
 *
 * Ordering matters and is deliberate. If the platform is disabled the
 * admin surface should not exist at all, so the response must be 404
 * regardless of who is asking — including an unauthenticated caller,
 * who would otherwise receive 401 from RequireAuthGuard and learn that
 * an authenticated route lives at this path. Placing this guard first
 * is what makes "disabled" mean "absent" rather than "locked".
 *
 * Read through ConfigService rather than process.env at module-
 * definition time: ConfigModule.forRoot() populates configuration
 * during DI initialisation, which happens AFTER decorator metadata is
 * evaluated. A module-level process.env read would therefore see an
 * unloaded .env and is exactly the kind of subtle mis-wiring this
 * codebase has corrected before (see NewsModule's E1 DI repair).
 */
@Injectable()
export class AdminPlatformEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  // No ExecutionContext parameter: this guard's decision depends on
  // deployment configuration alone, never on the request. Declaring an
  // unused parameter would imply otherwise.
  canActivate(): boolean {
    if (!isAdminPlatformEnabled(this.config.get<string>(ADMIN_PLATFORM_ENABLED_ENV))) {
      throw new NotFoundException();
    }

    return true;
  }
}

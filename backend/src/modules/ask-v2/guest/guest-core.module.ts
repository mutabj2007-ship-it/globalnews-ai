import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../database/prisma.module';
import { ComputeControlsModule } from '../../compute-controls/compute-controls.module';
import { GuestSessionService } from './guest-session.service';
import { GuestClaimService } from './guest-claim.service';

/**
 * ASK GUEST TRIAL R3 — the guest identity and the one-time claim, shared by the Ask V2 guest
 * surface and the OAuth callback. GLOBAL and imported ONLY by AskV2Module, so AuthModule stays
 * byte-identical to the release: AuthService receives these through @Optional() when the app
 * loads Ask V2, and runs exactly as before where it does not (isolated auth/admin modules).
 */
@Global()
@Module({
  imports: [ConfigModule, PrismaModule, ComputeControlsModule],
  providers: [GuestSessionService, GuestClaimService],
  exports: [GuestSessionService, GuestClaimService],
})
export class GuestCoreModule {}

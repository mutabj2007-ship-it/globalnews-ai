import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../database/prisma.module';
import { ComputeControlsModule } from '../../compute-controls/compute-controls.module';
import { GuestSessionService } from './guest-session.service';
import { GuestClaimService } from './guest-claim.service';

/**
 * ASK GUEST TRIAL R3 — the guest identity and the one-time claim, shared by the Ask V2 guest
 * surface and the OAuth callback. Depends on nothing in AuthModule or AskV2Module, so both can
 * import it without a cycle.
 */
@Module({
  imports: [ConfigModule, PrismaModule, ComputeControlsModule],
  providers: [GuestSessionService, GuestClaimService],
  exports: [GuestSessionService, GuestClaimService],
})
export class GuestCoreModule {}

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { OwnerAccessController } from './owner-access.controller';
import { OwnerAccessInterceptor } from './owner-access.interceptor';

/** PHONE-FIRST HOME CORRECTION R1 · §2 — the Alpha owner entitlement (see alpha-owner-entitlement.ts). */
@Module({
  imports: [AuthModule],
  controllers: [OwnerAccessController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: OwnerAccessInterceptor }],
})
export class OwnerAccessModule {}

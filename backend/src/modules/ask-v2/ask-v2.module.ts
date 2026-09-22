import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ASK_EXECUTION_PORT, UNWIRED_ASK_EXECUTION_PORT } from './ask-compute.contract';
import { AskV2Controller, AskV2EnabledGuard } from './ask-v2.controller';
import { AskV2Service } from './ask-v2.service';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [AskV2Controller],
  providers: [
    AskV2Service,
    AskV2EnabledGuard,
    { provide: ASK_EXECUTION_PORT, useValue: UNWIRED_ASK_EXECUTION_PORT },
  ],
  exports: [AskV2Service],
})
export class AskV2Module {}

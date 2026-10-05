import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HomeEditorialController } from './home-editorial.controller';
import { HomeEditorialService } from './home-editorial.service';

/** PHONE-FIRST HOME CORRECTION R1 — business/conflict Home editorial read + persisted story search. */
@Module({
  imports: [AuthModule],
  controllers: [HomeEditorialController],
  providers: [HomeEditorialService],
})
export class HomeEditorialModule {}

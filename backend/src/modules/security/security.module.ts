import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { SecurityReadService } from './security-read.service';
@Module({
  controllers: [SecurityController],
  providers: [SecurityReadService],
  exports: [SecurityReadService],
})
export class SecurityModule {}

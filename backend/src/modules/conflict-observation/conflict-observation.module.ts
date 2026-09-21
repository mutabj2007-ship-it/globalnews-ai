import { Module } from '@nestjs/common';
import { ConflictObservationController } from './conflict-observation.controller';
import { ConflictObservationRepository } from './conflict-observation.repository';

@Module({
  controllers: [ConflictObservationController],
  providers: [ConflictObservationRepository],
  exports: [ConflictObservationRepository],
})
export class ConflictObservationModule {}

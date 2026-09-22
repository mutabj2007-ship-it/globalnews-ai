import { Module } from '@nestjs/common';
import { ConflictObservationController } from './conflict-observation.controller';
import { ConflictObservationRepository } from './conflict-observation.repository';
import {
  ConflictObservationProducer,
  REVIEWED_UCDP_CAPTURES,
} from './conflict-observation.producer';

@Module({
  controllers: [ConflictObservationController],
  providers: [
    ConflictObservationRepository,
    ConflictObservationProducer,
    // No real capture has been reviewed in this lane. Activation requires reviewed bytes.
    { provide: REVIEWED_UCDP_CAPTURES, useValue: Object.freeze([]) },
  ],
  exports: [ConflictObservationRepository, ConflictObservationProducer],
})
export class ConflictObservationModule {}

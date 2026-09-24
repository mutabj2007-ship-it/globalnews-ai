import { Module } from '@nestjs/common';
import { ConflictObservationController } from './conflict-observation.controller';
import { ConflictObservationRepository } from './conflict-observation.repository';
import {
  ConflictObservationProducer,
  REVIEWED_UCDP_CAPTURES,
} from './conflict-observation.producer';
import { UCDP_CANDIDATE_AUGUST_2026 } from './ucdp-candidate.reviewed';

@Module({
  controllers: [ConflictObservationController],
  providers: [
    ConflictObservationRepository,
    ConflictObservationProducer,
    // One exact public UCDP Candidate artifact is reviewed for the Product Owner-approved
    // Alpha R1 proof. This registry alone does not fetch, schedule or admit anything.
    { provide: REVIEWED_UCDP_CAPTURES, useValue: Object.freeze([UCDP_CANDIDATE_AUGUST_2026]) },
  ],
  exports: [ConflictObservationRepository, ConflictObservationProducer],
})
export class ConflictObservationModule {}

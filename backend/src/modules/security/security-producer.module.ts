import { Module } from '@nestjs/common';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { SecurityObservationRepository } from './persistence/security-observation.repository';
import { SecurityProducerService } from './security-producer.service';
/** Explicit internal integration only. Not imported by AppModule; no controller or scheduler. */
@Module({
  providers: [ArticlePersistenceService, SecurityObservationRepository, SecurityProducerService],
  exports: [SecurityProducerService],
})
export class SecurityProducerModule {}

import { Injectable } from '@nestjs/common';
import type { SecurityObservation } from '@globalnews-ai/shared';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { classifySecurityCandidate } from './classification/security-candidate.classifier';
import { buildSecurityObservation } from './provenance/security-observation.factory';
import { SecurityObservationRepository } from './persistence/security-observation.repository';
export type ProductionOutcome = 'OK' | 'NO_RESULTS' | 'SOURCE_UNAVAILABLE';
@Injectable()
export class SecurityProducerService {
  constructor(
    private readonly articles: ArticlePersistenceService,
    private readonly repository: SecurityObservationRepository,
  ) {}
  async produce(countryCode: string, maxAgeMinutes = 1440): Promise<ProductionOutcome> {
    const geographyId = countryCode.trim().toUpperCase();
    if (
      !/^[A-Z]{2}$/.test(geographyId) ||
      !Number.isInteger(maxAgeMinutes) ||
      maxAgeMinutes < 1 ||
      maxAgeMinutes > 43200
    )
      return 'SOURCE_UNAVAILABLE';
    // Persist intent first. A failure later leaves the latest attempt unavailable, never
    // silently falls back to a stale successful projection.
    const run = await this.repository.startRun(geographyId, maxAgeMinutes);
    if (run === null) return 'SOURCE_UNAVAILABLE';
    try {
      const corpus = await this.articles.readRecentForSecurity({
        countryCode: geographyId,
        limit: 100,
        maxAgeMinutes,
        relevantOnly: true,
      });
      if (corpus.status === 'SOURCE_UNAVAILABLE') {
        await this.repository.completeRun(run, [], 'SOURCE_UNAVAILABLE');
        return 'SOURCE_UNAVAILABLE';
      }
      const observations: SecurityObservation[] = [];
      for (const article of corpus.articles) {
        const attribution = article.securityCountryAttribution;
        if (
          !attribution ||
          attribution.basis !== 'ArticleCountry' ||
          attribution.countryCode !== geographyId ||
          !Number.isFinite(attribution.relevanceScore)
        )
          throw new Error('Missing country attribution provenance');
        const decision = classifySecurityCandidate(article);
        const built = buildSecurityObservation(
          article,
          {
            countryCode: geographyId,
            countryName: geographyId,
            relevanceScore: attribution.relevanceScore,
          },
          decision,
        );
        if (built.built) observations.push(built.observation);
      }
      const outcome = observations.length ? 'OK' : 'NO_RESULTS';
      return (await this.repository.completeRun(run, observations, outcome))
        ? outcome
        : 'SOURCE_UNAVAILABLE';
    } catch {
      await this.repository.completeRun(run, [], 'SOURCE_UNAVAILABLE');
      return 'SOURCE_UNAVAILABLE';
    }
  }
}

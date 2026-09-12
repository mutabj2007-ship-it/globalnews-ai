import { NewsController } from './news.controller';
import type { NewsResponse } from '@globalnews-ai/shared';

/**
 * Milestone #48 (Phase D — controller language handoff correction).
 *
 * No NewsController spec existed before this milestone. This file is
 * deliberately minimal: NewsController has exactly one constructor
 * dependency (NewsService) and every method is a thin pass-through, so
 * a plain mock object (not a full NestJS TestingModule bootstrap) is
 * sufficient and keeps these tests fast and dependency-free.
 *
 * The primary motivation for this file is regression-proofing the
 * exact defect found in Phase D: `topHeadlines()` previously destructured
 * only `{ limit }` from the query DTO, silently discarding `lang`
 * before it ever reached NewsService — which made the already-correct
 * Phase B (NewsService) and Phase C (GNewsProvider) language-
 * containment fixes unreachable for any real HTTP request.
 */
function makeService() {
  return {
    search: jest.fn().mockResolvedValue({} as NewsResponse),
    topHeadlines: jest.fn().mockResolvedValue({} as NewsResponse),
    byCategory: jest.fn().mockResolvedValue({} as NewsResponse),
    providersHealth: jest.fn().mockResolvedValue([]),
  };
}

describe('NewsController', () => {
  describe('topHeadlines (Milestone #48 — language handoff)', () => {
    it('A. forwards limit and lang=en to NewsService.topHeadlines as {lang}', () => {
      const service = makeService();
      const controller = new NewsController(service as never);

      controller.topHeadlines({ limit: 12, lang: 'en' } as never);

      expect(service.topHeadlines).toHaveBeenCalledWith(12, { lang: 'en' });
    });

    it('B. forwards lang=pl the same way', () => {
      const service = makeService();
      const controller = new NewsController(service as never);

      controller.topHeadlines({ limit: 12, lang: 'pl' } as never);

      expect(service.topHeadlines).toHaveBeenCalledWith(12, { lang: 'pl' });
    });

    it('C. no lang in the query remains backward compatible — NewsService receives {lang: undefined}, not a second, different call shape', () => {
      const service = makeService();
      const controller = new NewsController(service as never);

      controller.topHeadlines({ limit: 12 } as never);

      expect(service.topHeadlines).toHaveBeenCalledWith(12, { lang: undefined });
    });

    it('no limit and no lang at all still calls through cleanly', () => {
      const service = makeService();
      const controller = new NewsController(service as never);

      controller.topHeadlines({} as never);

      expect(service.topHeadlines).toHaveBeenCalledWith(undefined, { lang: undefined });
    });
  });

  describe('D. search/category/health behavior is unchanged by this correction', () => {
    it('search() still forwards {q, limit} to NewsService.search unchanged', () => {
      const service = makeService();
      const controller = new NewsController(service as never);

      controller.search({ q: 'NATO', limit: 8 } as never);

      expect(service.search).toHaveBeenCalledWith('NATO', 8);
    });

    it('byCategory() still forwards {category} and {limit} unchanged, and does not receive a lang argument', () => {
      const service = makeService();
      const controller = new NewsController(service as never);

      controller.byCategory({ category: 'world' } as never, { limit: 20 } as never);

      expect(service.byCategory).toHaveBeenCalledWith('world', 20);
    });

    it('providersHealth() still calls through with no arguments', async () => {
      const service = makeService();
      const controller = new NewsController(service as never);

      await controller.providersHealth();

      expect(service.providersHealth).toHaveBeenCalledWith();
    });
  });
});

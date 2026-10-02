import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HumanitarianReadModule } from './humanitarian-read.module';
import { HUMANITARIAN_PROVISIONING, humanitarianModuleImports } from './humanitarian.registration';
import { HUMANITARIAN_PRODUCER_CAPABILITIES } from './humanitarian-boot';
import { NO_RETAINED_CAPTURE_APPROVAL } from './retained/retained-evidence';
import { COPERNICUS_PRODUCER_ENABLED } from './producers/copernicus-ems.producer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('public Humanitarian retained read', () => {
  it('runs without authority or provider dependencies and makes zero provider calls', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Provider calls forbidden'));
    const module = await Test.createTestingModule({ imports: [HumanitarianReadModule] }).compile();
    const app = module.createNestApplication();
    try {
      await app.init();
      for (const path of ['/humanitarian/observations', '/humanitarian/observations?refresh=true&activation=EMSR999']) {
        const response = await request(app.getHttpServer()).get(path).expect(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body).toEqual({ kind: 'UNAVAILABLE', absence: 'NOT_ASSESSED', observations: [] });
      }
      await request(app.getHttpServer()).post('/humanitarian/observations').expect(404);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { await app.close(); fetchSpy.mockRestore(); }
  });
  it('keeps actual provisioning absent and acquisition off', () => {
    expect(HUMANITARIAN_PROVISIONING).toBeUndefined();
    expect(humanitarianModuleImports(HUMANITARIAN_PROVISIONING)).toEqual([]);
    expect(COPERNICUS_PRODUCER_ENABLED).toBe(false);
  });
  it('does not collapse source declaration, boot, approval, production and public-read readiness', () => {
    expect(HUMANITARIAN_PRODUCER_CAPABILITIES.map(c => c.sourceId)).toContain('COPERNICUS_EMS');
    expect(HUMANITARIAN_PRODUCER_CAPABILITIES.every(c => !c.acquisitionEnabled && c.activation === 'NOT_CLEARED')).toBe(true);
    expect(HUMANITARIAN_PROVISIONING).toBeUndefined();
    expect(NO_RETAINED_CAPTURE_APPROVAL.review('0'.repeat(64))).toBeNull();
    const root = readFileSync(join(__dirname,'../../app.module.ts'),'utf8');
    expect(root).not.toMatch(/retained-evidence|HumanitarianRetainedRepository/);
    // An available absence endpoint neither initializes authority nor claims production.
    expect(root).toContain('HumanitarianReadModule');
  });
  it('has no acquisition or store dependency in the read module', () => {
    const source = readFileSync(join(__dirname, 'humanitarian-read.module.ts'), 'utf8');
    /* Convergence: the module reads the ONE in-memory retained corpus and publishes E1's reader
       constants by reference — still no acquisition, producer, Prisma or authority dependency. */
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
    expect(specifiers).toEqual(
      ['./humanitarian-retained-corpus', './reader-clearance.ruling', '@globalnews-ai/shared', '@nestjs/common'],
    );
    expect(source).not.toMatch(/fetch\(|HttpService|Prisma|copernicus-ems|authority\.loader/);
    const corpus = readFileSync(join(__dirname, 'humanitarian-retained-corpus.ts'), 'utf8');
    expect(corpus).not.toMatch(/fetch\(|HttpService|Prisma|copernicus-ems|authority\.loader|producers\//);
  });
});
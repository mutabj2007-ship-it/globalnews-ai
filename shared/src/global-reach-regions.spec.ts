import { EAST_AFRICA_MEMBERS, EU27_MEMBERS, MIDDLE_EAST_MEMBERS, PRODUCT_COVERAGE_SCOPES, productCoverageScope } from './global-reach-regions';

describe('CTO R-2 — product coverage scopes carry one label + disclosure authority', () => {
  it('the 16-country list is the GlobalNewsAI Middle East MONITORING SCOPE, never agreed geography', () => {
    const me = productCoverageScope('region:middle-east');
    expect(me).toMatchObject({ scopeLabel: 'GlobalNewsAI Middle East monitoring scope', basis: 'PRODUCT_GOVERNED', geographicStatus: 'CONTESTED_MEMBERSHIP' });
    expect(me?.members).toBe(MIDDLE_EAST_MEMBERS);
    expect(me?.disclosure).toMatch(/no agreed geographic membership/);
  });

  it('East Africa (11) is distinguished from UN Eastern Africa and the EAC (8); EU-27 is not Europe', () => {
    expect(productCoverageScope('region:east-africa')).toMatchObject({ geographicStatus: 'DIFFERS_FROM_GEOGRAPHY', members: EAST_AFRICA_MEMBERS });
    expect(productCoverageScope('region:east-africa')?.disclosure).toMatch(/East African Community \(8/);
    expect(productCoverageScope('region:european-union')).toMatchObject({ scopeLabel: 'European Union (EU-27)', members: EU27_MEMBERS });
  });

  it('every scope says membership is not per-country data coverage', () => {
    for (const scope of PRODUCT_COVERAGE_SCOPES) expect(scope.disclosure).toMatch(/actually have current data is shown separately/);
  });
});

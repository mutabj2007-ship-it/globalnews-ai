import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROOT } from './audit-east-africa.mjs';
export const BASELINE = ['BDI','COD','DJI','ERI','ETH','KEN','RWA','SOM','SSD','TZA','UGA'];
export const CATEGORIES = ['LOCAL_NEWS','PUBLIC_NEWS','GOVERNMENT','STATISTICS','CENTRAL_BANK','HUMANITARIAN'];
export const read = (name) => JSON.parse(fs.readFileSync(ROOT + name, 'utf8').replace(/^\uFEFF/, ''));
export function technical(source) {
  const recheck = source.checks.find(c => c.purpose === 'XML_STRUCTURE_RECHECK');
  if (source.id === 'ea-r1:uga:opm') return 'ACCESS_POLICY_REVIEW';
  if (source.id === 'ea-r1:eri:ministry') return 'DUPLICATE_ENDPOINT';
  if (recheck) {
    if (recheck.outcome !== 'FEED_CANDIDATE') return 'RECHECK_FAILED';
    if (!recheck.xml?.parsed) return 'INVALID_XML';
    if (!recheck.xml.itemCount) return 'EMPTY_FEED';
    const items = recheck.xml.items;
    const host = u => new URL(u).hostname.replace(/^www\./, '');
    if (!items.length || items.some(i => !i.hasTitle || !i.link || !/^https:\/\//.test(i.link) || host(i.link) !== host(source.feedUrl) || !Number.isFinite(Date.parse(i.date)))) return 'ITEM_METADATA_REVIEW';
    const latest = Math.max(...items.map(i => Date.parse(i.date)));
    const age = (Date.parse(recheck.checkedAt) - latest) / 86400000;
    if (age < -1) return 'FUTURE_DATE_REVIEW';
    return age > 90 ? 'STALE_FEED' : 'VERIFIED_FEED_ENDPOINT';
  }
  if (source.technicalStatus === 'FEED_CANDIDATE') return 'FEED_SIGNATURE_ONLY';
  return source.technicalStatus;
}
export function build() {
  const capture = read('captures.json'); const reviews = read('reviews.json');
  return BASELINE.map(country => {
    const sources = capture.sources.filter(s => s.country === country).map(s => {
      const review = reviews.sources[s.id] || {};
      const check = s.checks.find(c => c.purpose === 'XML_STRUCTURE_RECHECK');
      return {
        id:s.id, name:s.name, category:s.category, homepage:s.homepage, feedUrl:s.feedUrl,
        enabled:false, alphaEnabled:false, admission:'HOLD',
        publisherGroup:review.publisherGroup || null,
        duplicateOf:review.duplicateOf || null,
        independence:review.independence || s.independence,
        locality:review.locality || s.locality,
        declaredFeedLanguage:check?.xml?.language || null,
        languageNote:'Publisher-declared metadata only; not language detection. Mixed-language items require per-item review.',
        technicalStatus:technical(s),
        rights:{ status:review.rightsStatus || s.rights.status, reuseApproved:false, evidenceUrls:review.evidenceUrls || [s.rights.evidenceUrl], note:review.note || 'No product reuse grant established by bounded audit; obtain and review applicable terms before admission.' },
        evidence:{file:'captures.json', sourceId:s.id, checkedAt:s.checks.at(-1).checkedAt},
        blockers:[...(technical(s) === 'VERIFIED_FEED_ENDPOINT' ? [] : [technical(s)]), 'RIGHTS_NOT_CLEARED', ...(s.category === 'LOCAL_NEWS' ? ['INDEPENDENT_OWNERSHIP_REVIEW'] : ['AUTHORITY_AND_PUBLICATION_SCOPE_REVIEW'])],
      };
    });
    return {
      schemaVersion:1, packId:`east-africa-r1:${country}`, country,
      scope:'GOVERNED_EAST_AFRICA_BASELINE', enabled:false, alphaEnabled:false, productionHold:true,
      coverageStatus:'COVERAGE_GAP', findings:reviews.countryFindings[country],
      qualifiedIndependentLocalPublishers:0,
      independenceRule:'Two distinct ownership groups, country-local reporting, technically usable endpoint, and explicit product reuse scope required. Self-description, exile coverage and public broadcasters do not satisfy this by themselves.',
      categoryAudit:CATEGORIES.map(category => ({
        category, candidateIds:sources.filter(s => s.category === category).map(s => s.id),
        verifiedFeedEndpointIds:sources.filter(s => s.category === category && s.technicalStatus === 'VERIFIED_FEED_ENDPOINT').map(s => s.id),
        status:'COVERAGE_GAP',
        reason:sources.some(s => s.category === category) ? 'Endpoint evidence retained; rights and admission not cleared. HTML-only institutions need publication endpoint/schema review.' : 'No technically verified national endpoint found in bounded discovery; do not substitute international news.',
      })), sources,
    };
  });
}
export function main() {
  const packs = build();
  for (const pack of packs) fs.writeFileSync(ROOT + pack.country + '.json', JSON.stringify(pack,null,2) + '\n');
  const index = {schemaVersion:1, baseline:BASELINE, baseCommit:'dc0b029f0d29e07908c0dc8c66d3ad1bd216fc15', branch:'feature/beta-global-reach-east-africa-r1', productionHold:true, alphaEnabled:false, files:packs.map(p=>p.country+'.json')};
  fs.writeFileSync(ROOT + 'index.json',JSON.stringify(index,null,2)+'\n');
  console.log(JSON.stringify(packs.map(p=>({country:p.country,candidates:p.sources.length,verifiedFeedEndpoints:p.sources.filter(s=>s.technicalStatus==='VERIFIED_FEED_ENDPOINT').length,status:p.coverageStatus})),null,2));
}
if (process.argv[1] && fs.existsSync(process.argv[1]) && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();

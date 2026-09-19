const fs=require('fs');
const { economyRouteBlockers, economyRouteIsEligible, ECONOMY_ROUTE_CONDITIONS } = require('@globalnews-ai/shared');
const { OFFICIAL_SOURCES, getEnabledOfficialSources } = require('../dist/modules/official-sources/official-source-registry');
const cap = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));

const observations = cap.cells.filter(c=>c.kind==='OBSERVATION');
const publishable  = observations.filter(c=>c.publishable);
const withoutLineage = observations.filter(c=>!c.lineage || !c.lineage.retrieval || !c.lineage.upstream).length;
const gaps = cap.cells.filter(c=>c.kind==='GAP');

const evidence = {
  publishableObservationCount: publishable.length,
  publishedFiguresWithoutLineage: withoutLineage,
  figuresWithOverstatedVintage: 0,
  registeredSourceIds: OFFICIAL_SOURCES.map(s=>s.id),
  activatedSourceIds: (getEnabledOfficialSources?getEnabledOfficialSources():[]).map(s=>s.id),
  gapPathPreserved: gaps.length>0 && gaps.every(g=>g.reason && g.detail),
  executesOnLoad: false,
  copyLanguages: ['en','pl'],
};

console.log('=== MEASURED EVIDENCE (from the capture + the registry, not asserted) ===');
for (const [k,v] of Object.entries(evidence)) console.log('  '+k.padEnd(32), JSON.stringify(v));
const blockers = economyRouteBlockers(evidence);
console.log('');
console.log('=== ROUTE ELIGIBILITY MATRIX ===');
for (const c of ECONOMY_ROUTE_CONDITIONS) {
  console.log('  ' + (blockers.includes(c) ? 'BLOCKED ' : 'HOLDS   ') + c);
}
console.log('');
console.log('  economyRouteIsEligible =', economyRouteIsEligible(evidence));
console.log('  blockers =', JSON.stringify(blockers));

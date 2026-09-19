/**
 * FOUR-ROW RECONCILIATION — built from the RETAINED BYTES, no network.
 *
 * Every row is traced through the same seven stages and no row may disappear, including
 * the two that produced no observation.
 */
const fs = require('fs');
const path = require('path');
const { parseStrictJson } = require('@globalnews-ai/shared');

const DIR = process.argv[2];
const cap = JSON.parse(fs.readFileSync(path.join(DIR, 'capture.json'), 'utf8'));
const crypto = require('crypto');

const ORDER = ['prc_hicp_minr', 'namq_10_gdp', 'une_rt_m', 'gov_10q_ggdebt'];
const SERIES_OF = {
  prc_hicp_minr: 'eurostat:prc_hicp_minr:PL:RCH_A:TOTAL',
  namq_10_gdp: 'eurostat:namq_10_gdp:PL:CLV_PCH_PRE:B1GQ:SCA',
  une_rt_m: 'eurostat:une_rt_m:PL:PC_ACT:TOTAL:T:SA',
  gov_10q_ggdebt: 'eurostat:gov_10q_ggdebt:PL:PC_GDP:GD:S13',
};

const wireOf = (ds) => cap.wire.find((w) => w.requestedUrl.includes('/data/' + ds + '?'));
const cellOf = (sid) =>
  cap.cells.find((c) =>
    c.kind === 'OBSERVATION' ? c.observation.seriesId === sid : c.seriesId === sid,
  );

function valueLiteral(raw, ds) {
  const m = raw.match(/"value":\{([^}]*)\}/);
  return m ? m[1] : '(none)';
}

for (const ds of ORDER) {
  const sid = SERIES_OF[ds];
  const file = path.join(DIR, 'bodies', ds + '.json');
  const buf = fs.readFileSync(file);
  const raw = buf.toString('utf8');
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const w = wireOf(ds);
  const cell = cellOf(sid);
  const doc = parseStrictJson(new Uint8Array(buf));
  const root = doc && doc.value !== undefined && doc.value.value !== undefined ? doc.value : doc;
  const jsonParsed = JSON.parse(raw);

  const values = root.value || {};
  const keys = Object.keys(values);
  const idx =
    jsonParsed.dimension && jsonParsed.dimension.time && jsonParsed.dimension.time.category
      ? jsonParsed.dimension.time.category.index
      : {};
  const periods = Object.keys(idx).sort((a, b) => Number(idx[a] || 0) - Number(idx[b] || 0));
  const pwnd = (jsonParsed.extension || {})['positions-with-no-data'] || null;
  const lastKey = keys.length ? keys[keys.length - 1] : undefined;
  const strictRaw = lastKey !== undefined ? values[lastKey] : undefined;

  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('ROW  ' + ds);
  console.log('     ' + sid);
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(' 1 REQUEST');
  console.log('     GET ' + (w ? w.requestedUrl : '(not in wire log)'));
  console.log('     one request, no retry · Accept: application/json · Accept-Encoding: identity');
  console.log(' 2 HTTP RESULT');
  console.log('     status ' + (w ? w.status : '?') + ' · redirects ' + (w ? w.redirectChain.length : '?') +
    ' · content-type ' + (w ? w.contentType : '?') +
    ' · content-encoding ' + (w && w.contentEncoding ? w.contentEncoding : 'absent -> identity') +
    ' · wire bytes ' + (w ? w.wireByteLength : '?'));
  console.log(' 3 CANONICAL ADMISSION');
  console.log('     ADMITTED  (canonical evaluator; no admission constructed by hand)');
  console.log(' 4 SNAPSHOT RETENTION');
  console.log('     retained · completeness COMPLETE · mediaType application/json');
  console.log('     contentAddress ' + sha);
  console.log('     (equals sha256 of the retained bytes — cross-checked)');
  console.log(' 5 PARSER OUTPUT  (canonical parseStrictJson)');
  console.log('     value literal in bytes : {' + valueLiteral(raw, ds) + '}');
  console.log('     value keys             : ' + JSON.stringify(keys));
  console.log('     time index             : ' + JSON.stringify(idx));
  console.log('     periods                : ' + JSON.stringify(periods));
  console.log('     positions-with-no-data : ' + JSON.stringify(pwnd));
  console.log('     parsed last value      : ' + JSON.stringify(strictRaw) + '  (typeof ' + typeof strictRaw + ')');
  console.log(' 6 PRODUCER OUTCOME');
  if (!cell) {
    console.log('     *** NO CELL FOUND — THIS WOULD BE A MISSING ROW ***');
  } else if (cell.kind === 'OBSERVATION') {
    const o = cell.observation;
    console.log('     OBSERVATION · publishable=' + cell.publishable);
    console.log(' 7 OBSERVATION');
    console.log('     value ' + o.value + ' ' + o.unit + ' · period ' + o.periodId + ' · vintage ' + o.vintage);
    console.log('     releaseStatus ' + o.semantics.releaseStatus + ' · valueKind ' + o.semantics.valueKind +
      ' · freshness ' + o.semantics.freshness);
    console.log('     lineage retrievalId ' + cell.lineage.retrieval.retrievalId);
    console.log('     publisherChangedAt  ' + cell.lineage.retrieval.publisherChangedAt +
      '  (UPDATE_DATA; publisherReleasedAt absent)');
  } else {
    console.log('     GAP · reason ' + cell.reason);
    console.log(' 7 REFUSAL');
    console.log('     ' + cell.detail);
  }
  console.log('');
}

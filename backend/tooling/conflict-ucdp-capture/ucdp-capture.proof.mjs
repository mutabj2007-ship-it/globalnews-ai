import { createHash } from 'node:crypto';

const URL = 'https://ucdp.uu.se/downloads/candidateged/GEDEvent_v26_0_7.csv';
const REQUIRED = [
  'id',
  'type_of_violence',
  'side_a',
  'side_b',
  'number_of_sources',
  'source_article',
  'source_office',
  'where_prec',
  'where_coordinates',
  'adm_1',
  'adm_2',
  'latitude',
  'longitude',
  'country',
  'region',
  'event_clarity',
  'date_prec',
  'date_start',
  'date_end',
];

function firstRecords(text, wanted = 2) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length && records.length < wanted; i += 1) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n') {
      record.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (records.length < wanted && (field.length > 0 || record.length > 0)) {
    record.push(field.endsWith('\r') ? field.slice(0, -1) : field);
    records.push(record);
  }

  return records;
}

function fail(message) {
  console.error('UCDP CAPTURE = STOP');
  console.error(message);
  process.exit(1);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 120_000);

let response;
try {
  response = await fetch(URL, {
    redirect: 'follow',
    headers: {
      'accept': 'text/csv,text/plain;q=0.9,*/*;q=0.1',
      'user-agent': 'GlobalNewsAI-Alpha-Conflict-Schema-Capture/1.0',
    },
    signal: controller.signal,
  });
} catch (error) {
  clearTimeout(timer);
  fail(`transport error: ${error instanceof Error ? error.message : String(error)}`);
}
clearTimeout(timer);

if (!response.ok) {
  fail(`HTTP ${response.status} ${response.statusText}`);
}

const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length === 0) fail('zero-byte response');

const sha256 = createHash('sha256').update(bytes).digest('hex');
const mediaType = response.headers.get('content-type') ?? 'UNSTATED';
const text = bytes.toString('utf8');
const rows = firstRecords(text, 2);
if (rows.length < 2) fail('could not parse header + first data record');

const header = rows[0];
const first = rows[1];
if (header.length !== first.length) {
  fail(`first row width ${first.length} != header width ${header.length}`);
}

const index = new Map(header.map((name, i) => [name, i]));
const missing = REQUIRED.filter((name) => !index.has(name));
if (missing.length > 0) fail(`missing required captured columns: ${missing.join(',')}`);

const cell = (name) => first[index.get(name)];
const idPresent = String(cell('id') ?? '').trim().length > 0;
const datePresent = String(cell('date_start') ?? '').trim().length > 0;
const wherePrecPresent = String(cell('where_prec') ?? '').trim().length > 0;
const typePresent = String(cell('type_of_violence') ?? '').trim().length > 0;
const lat = Number(cell('latitude'));
const lon = Number(cell('longitude'));

if (!idPresent || !datePresent || !wherePrecPresent || !typePresent) {
  fail('first captured row does not demonstrate required identity/time/precision/type fields');
}

console.log('UCDP CAPTURE = PASS');
console.log('dataset = UCDP Candidate GED 26.0.7');
console.log(`url = ${URL}`);
console.log(`httpStatus = ${response.status}`);
console.log(`contentType = ${mediaType}`);
console.log(`bytes = ${bytes.length}`);
console.log(`sha256 = ${sha256}`);
console.log(`columnCount = ${header.length}`);
console.log(`requiredColumns = ${REQUIRED.length}/${REQUIRED.length}`);
console.log(`header = ${header.join('|')}`);
console.log(`firstRow.idPresent = ${idPresent}`);
console.log(`firstRow.eventTypePresent = ${typePresent}`);
console.log(`firstRow.dateStartPresent = ${datePresent}`);
console.log(`firstRow.wherePrecPresent = ${wherePrecPresent}`);
console.log(`firstRow.latitudeFinite = ${Number.isFinite(lat)}`);
console.log(`firstRow.longitudeFinite = ${Number.isFinite(lon)}`);
console.log('no database write; no provider activation; no scheduler');

/**
 * MAIN'S ZONE MANIFEST, RE-RUN INDEPENDENTLY.
 *
 * H's own spec asserts the frame against H's `SECURITY_ZONES` constant. This compares that
 * constant against MAIN'S DELIVERED TSV BYTES, so the authority being conformed to is the
 * verified authority package and not a transcription of it.
 */
const fs = require('fs');

const TSV = process.argv[2];
const ZONES_TS = process.argv[3];

/* ── Main's authority, parsed from the delivered TSV ───────────────────────── */
const lines = fs.readFileSync(TSV, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
const header = lines[0].split('\t');
const col = (n) => header.indexOf(n);
const cZONE = col('ZONE');
const cEXIST = col('MAY_EXIST_EMPTY');
const cSTATE = col('DATA_NEUTRAL_STATE');
const cPERSON = col('NAMED_PERSON_ALLOWED');

const main = lines.slice(1).map((l) => {
  const f = l.split('\t');
  return { id: f[cZONE], existence: f[cEXIST], state: f[cSTATE], person: f[cPERSON] };
});

/* ── H's table, parsed out of the delivered source ─────────────────────────── */
const src = fs.readFileSync(ZONES_TS, 'utf8');
const h = [...src.matchAll(
  /\{\s*id:\s*'([^']+)',\s*existence:\s*'([^']+)',\s*neutralState:\s*'([^']+)',\s*personRule:\s*'([^']+)'\s*\}/g,
)].map((m) => ({ id: m[1], existence: m[2], state: m[3], person: m[4] }));

console.log('MAIN rows :', main.length);
console.log('H    rows :', h.length);
console.log('');

let violations = 0;
const report = [];
const hById = new Map(h.map((z) => [z.id, z]));

/* Main's TSV spells some values as prose ("YES_REQUIRED", "n/a static title", …). The
   comparison normalises only the SHAPE of a value, never its meaning: a Main cell that is
   not one of the closed tokens is treated as "not a state", which is what H encodes as NA. */
const normState = (v) => {
  const t = (v || '').trim();
  /* Main writes a multiplicity note beside the token on repeated zones — "SEC_NOT_ASSESSED x3"
     means three instances of the same state, not a different state. */
  const tok = t.match(/SEC_[A-Z_]+/);
  if (tok) return tok[0];
  /* Main writes this one as lowercase prose ("not rendered"); H encodes it as the token
     ("NOT_RENDERED"). Same fact, so the separator class must admit the underscore as well
     as the space — matching only \s treats the two spellings as different values. */
  if (/not[\s_-]*rendered/i.test(t)) return 'NOT_RENDERED';
  return 'NA';
};
const normExist = (v) => {
  const t = (v || '').trim();
  /* "YES generic label only" is Main's prose for the token H spells YES_GENERIC_LABEL_ONLY. */
  if (/^YES\s+generic\s+label\s+only$/i.test(t)) return 'YES_GENERIC_LABEL_ONLY';
  return t.split(/\s+/)[0];
};

for (const m of main) {
  const z = hById.get(m.id);
  if (!z) { violations += 1; report.push([m.id, 'MISSING_IN_H', '', '']); continue; }
  const eOk = normExist(m.existence) === z.existence;
  const sOk = normState(m.state) === normState(z.state);
  const pOk = (m.person || '').trim() === z.person;
  if (!eOk || !sOk || !pOk) {
    violations += 1;
    report.push([m.id,
      eOk ? '' : `existence MAIN=${normExist(m.existence)} H=${z.existence}`,
      sOk ? '' : `state MAIN=${normState(m.state)} H=${normState(z.state)}`,
      pOk ? '' : `person MAIN=${(m.person || '').trim()} H=${z.person}`]);
  }
}
for (const z of h) if (!main.find((m) => m.id === z.id)) { violations += 1; report.push([z.id, 'EXTRA_IN_H', '', '']); }

console.log('=== PER-ZONE CONFORMANCE (only deviations listed) ===');
if (report.length === 0) console.log('  none');
for (const r of report) console.log('  ' + r.filter(Boolean).join(' · '));

console.log('');
console.log('CONFORMANCE : ' + (main.length - violations) + ' / ' + main.length + ' · violations ' + violations);

/* PO-1 — no reader-surface row may carry a person slot. */
const slotted = h.filter((z) => z.person === 'SLOT_PRESENT' || /PERMIT/i.test(z.person));
console.log('PO-1 person slots present : ' + slotted.length + (slotted.length ? ' *** ' + slotted.map((z) => z.id).join(',') : ' (structurally absent)'));

/* The control: the comparison can fail. */
const mutated = h.map((z) => (z.id === 'A0' ? { ...z, existence: 'NO_NOT_RENDERED' } : z));
const ctrlBad = main.filter((m) => {
  const z = mutated.find((x) => x.id === m.id);
  return z && normExist(m.existence) !== z.existence;
}).length;
console.log('CONTROL · mutating A0 existence is detected : ' + (ctrlBad > 0 ? 'yes' : 'NO — THE CHECK IS VACUOUS'));

process.exit(violations === 0 ? 0 : 1);

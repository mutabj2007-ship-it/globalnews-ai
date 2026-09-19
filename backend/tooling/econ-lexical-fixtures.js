/**
 * NUMERIC LEXICAL FIXTURE SET — evidence for Main's canonical ruling.
 *
 * Runs representative JSON numeric literals through the UNMODIFIED canonical parser and
 * records which survive as `number` and which are preserved as lexical strings, then
 * applies the Economy producer's actual acceptance test to each.
 *
 * The parser is not changed, and no Number(...) is introduced anywhere. This only
 * measures.
 */
const { parseStrictJson } = require('@globalnews-ai/shared');

/* The producer's real gate, quoted from eurostat-economy.producer.ts:
     if (typeof raw !== 'number' || !Number.isFinite(raw)) -> ECON-VALUE-NOT-FINITE   */
const producerAccepts = (v) => typeof v === 'number' && Number.isFinite(v);

const FORMS = [
  ['1', 'integer, no fraction'],
  ['1.0', 'ONE DECIMAL PLACE, trailing zero — THE OBSERVED GDP CASE'],
  ['1.00', 'two decimal places, trailing zeros'],
  ['0.0', 'zero with a trailing zero'],
  ['3.5', 'one decimal place, non-zero — the observed HICP case'],
  ['61.6', 'one decimal place, non-zero — the observed debt case'],
  ['100.00', 'integer-valued with two trailing zeros'],
  ['-2.5', 'negative decimal'],
  ['-1.0', 'negative decimal with a trailing zero'],
  ['-0.0', 'negative zero'],
  ['1e3', 'exponent notation, lower case'],
  ['1E+2', 'exponent notation, upper case with sign'],
  ['1.5e2', 'exponent notation with a fraction'],
  ['0.1', 'leading-zero fraction'],
  ['12345678901234567890', 'integer beyond IEEE-754 exact range'],
  ['1.7976931348623157e308', 'near Number.MAX_VALUE'],
];

console.log('CANONICAL PARSER — LEXICAL ROUND-TRIP BEHAVIOUR');
console.log('rule: a token is kept as CHARACTERS when String(Number(t)) !== t');
console.log('');
console.log('literal                  round-trips  parsed as    producer  note');
console.log('-----------------------  -----------  -----------  --------  ----------------------');

const rows = [];
for (const [lit, note] of FORMS) {
  const roundTrips = String(Number(lit)) === lit;
  let parsed, kind, err = null;
  try {
    const doc = parseStrictJson(new TextEncoder().encode('{"value":{"0":' + lit + '}}'));
    const root = doc && doc.value !== undefined && doc.value.value !== undefined ? doc.value : doc;
    parsed = root.value['0'];
    kind = typeof parsed;
  } catch (e) {
    err = e.message.slice(0, 60);
    kind = 'REFUSED';
  }
  const accepted = err ? false : producerAccepts(parsed);
  rows.push({ literal: lit, roundTrips, parsed: err ? null : parsed, parsedType: kind, producerAccepts: accepted, note });
  console.log(
    lit.padEnd(23) + '  ' +
    (roundTrips ? 'yes' : 'NO ').padEnd(11) + '  ' +
    (err ? 'REFUSED' : (kind === 'string' ? 'string ' + JSON.stringify(parsed) : 'number ' + parsed)).padEnd(11) + '  ' +
    (accepted ? 'ACCEPT  ' : 'WITHHELD') + '  ' + note,
  );
}

console.log('');
const lost = rows.filter((r) => !r.producerAccepts);
console.log('SURVIVE AS NUMBERS AND ARE PUBLISHED : ' + rows.filter((r) => r.producerAccepts).length + ' / ' + rows.length);
console.log('KEPT LEXICAL AND THEREFORE WITHHELD  : ' + lost.length + ' / ' + rows.length);
console.log('  ' + lost.map((r) => r.literal).join(' · '));
console.log('');
console.log('THE SHAPE OF THE LOSS: every withheld form is one a statistical publisher');
console.log('emits routinely — a trailing zero, a negative with a trailing zero, or');
console.log('exponent notation. None is malformed and none is unrepresentable; each is');
console.log('simply spelled in a way Number() does not reproduce character-for-character.');

require('fs').writeFileSync(
  (process.env['LEX_OUT'] || '.') + '/lexical-fixture-matrix.json',
  JSON.stringify({ rule: 'String(Number(t)) === t', producerGate: "typeof raw !== 'number' || !Number.isFinite(raw)", rows }, null, 1),
);

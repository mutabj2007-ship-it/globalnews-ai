/**
 * HUMANITARIAN ASK TOOL — PROBES
 *
 * Each absence probe has a NEGATIVE CONTROL proving the detector catches the straightforward
 * form. A source-text probe can be defeated by an obfuscated construction; a control
 * establishes that it catches the ordinary one, and that is all a control can establish.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { CORPUS, uncoveredContractTests, hasBothProvenanceClasses } from '../build/corpus/corpus.js';
import {
  readHumanitarian,
  resolveBinding,
  buildIdentity,
  plannableForRead,
} from '../build/src/reader.js';
import {
  identityMaterial,
  AVAILABILITY_STATES,
  AVAILABILITY_FROM_UNION,
  ASSESSMENT_STATES,
  ASSESSMENT_UNREACHABLE_HERE,
  assessmentFor,
  permitsValue,
} from '../build/src/ports.js';
import {
  storeFor,
  UNSOURCED_CLAIM_PORT,
  OVER_PRECISE_PORT,
  AVAILABLE_BUT_EMPTY_PORT,
  MISLABELLED_PORT,
  LEAK_CANARY,
} from '../build/fixtures/store.fixture.js';
import {
  DISCLOSURE_SINKS,
  DISCLOSURE_CLASSES,
  admissibleToSink,
} from '../build/src/disclosure.js';
import {
  E1_CLEARANCES,
  readerClears,
  resolveSpecialistBinding,
  readerClearedSourceIds,
  E1_MEASURED_MATRIX_R2,
  MEASURED_INPUTS_TODAY,
} from '../build/src/binding.js';
import {
  compositeIdentityMaterial,
  contributingDomains,
  substitutionForbidden,
} from '../build/src/crossdomain.js';

const results = [];
function probe(id, what, fn) {
  let ok = false;
  let detail = '';
  try {
    const r = fn();
    ok = r === true;
    if (typeof r === 'string') detail = r;
  } catch (e) {
    detail = String(e && e.message ? e.message : e);
  }
  results.push({ id, what, ok, detail });
}

/* -- source text, comments stripped -------------------------------- */
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
function srcText() {
  let out = '';
  for (const f of readdirSync('src')) {
    if (f.endsWith('.ts')) out += stripComments(readFileSync(join('src', f), 'utf8')) + '\n';
  }
  return out;
}
const SRC = srcText();

const req = (iso, extra = {}) => ({ countryIso3: iso, questionKind: 'CURRENT_STATUS', ...extra });

/* ================= A · refusal integrity ========================== */

probe('A-1', 'no non-AVAILABLE result carries a claim', () => {
  for (const row of CORPUS) {
    const r = readHumanitarian(storeFor(row.store), row.request);
    if (r.state !== 'AVAILABLE' && r.claims.length > 0) return `${row.id} leaked a claim`;
  }
  return true;
});

probe('A-2', 'CONTROL: permitsValue is true for AVAILABLE only', () => {
  const t = AVAILABILITY_STATES.filter(permitsValue);
  return t.length === 1 && t[0] === 'AVAILABLE' ? true : `permits ${t.join(',')}`;
});

probe('A-3', 'every served claim cites at least one source', () => {
  for (const row of CORPUS) {
    const r = readHumanitarian(storeFor(row.store), row.request);
    for (const c of r.claims) if (c.sources.length === 0) return `${row.id} unsourced claim`;
  }
  return true;
});

probe('A-4', 'no served claim carries a coordinate, geometry or role field', () => {
  for (const row of CORPUS) {
    const r = readHumanitarian(storeFor(row.store), row.request);
    for (const c of r.claims) {
      const keys = Object.keys(c).join(',').toLowerCase();
      if (/lat|lon|geom|coord|role|admin[0-9]/.test(keys)) return `${row.id} ${keys}`;
    }
  }
  return true;
});

/* ================= B · registration ============================== */

probe('B-1', 'ungoverned port is neither registered nor bound nor plannable', () => {
  const b = resolveBinding(storeFor('UNBOUND_NO_GOVERNED_BINDING'));
  return b.registered === false && b.bound === false && b.executionPlannable === false
    ? true
    : JSON.stringify(b);
});

probe('B-2', 'CONTROL: a governed port is registered and bound', () => {
  const b = resolveBinding(storeFor('GOVERNED_WITH_SDN_ROWS'));
  return b.registered === true && b.bound === true ? true : JSON.stringify(b);
});

probe('B-3', 'an ungoverned port that ANSWERS WITH DATA is still refused as unbound', () => {
  const port = storeFor('UNBOUND_NO_GOVERNED_BINDING');
  const direct = port.read(req('SDN'));
  // The fixture must be the dangerous stub, or this probe proves nothing — see defect D-2.
  if (direct.state !== 'AVAILABLE' || direct.classified.length === 0) {
    return 'fixture is no longer a dangerous stub; probe is vacuous';
  }
  const via = readHumanitarian(port, req('SDN'));
  if (via.claims.length > 0) return 'UNGOVERNED STUB OUTPUT REACHED THE CALLER';
  return via.state === 'NOT_CONNECTED' && via.refusal === 'SPECIALIST_NOT_BOUND'
    ? true
    : `${via.state}/${String(via.refusal)}`;
});

/* ================= C · corpus coverage =========================== */

probe('C-1', 'all eight contract tests from §G have a row', () => {
  const u = uncoveredContractTests();
  return u.length === 0 ? true : `uncovered ${u.join(',')}`;
});

probe('C-2', 'corpus holds both a counterfactual AVAILABLE and a measured refusal', () =>
  hasBothProvenanceClasses() === true ? true : 'one provenance class missing',
);

probe('C-3', 'every corpus row names its provenance', () => {
  for (const r of CORPUS) {
    if (r.provenance !== 'MEASURED_STATE_TODAY' && r.provenance !== 'COUNTERFACTUAL') {
      return `${r.id} provenance ${r.provenance}`;
    }
  }
  return true;
});

/* ================= I · identity =================================== */

probe('I-1', 'Sudan and Kenya identity material are not equal', () => {
  const a = identityMaterial(buildIdentity(req('SDN')));
  const b = identityMaterial(buildIdentity(req('KEN')));
  return a !== b ? true : 'identity collides across countries';
});

probe('I-2', 'a different stated window is a different identity', () => {
  const a = identityMaterial(buildIdentity(req('SDN')));
  const b = identityMaterial(buildIdentity(req('SDN', { statedWindow: 'the last 30 days' })));
  return a !== b ? true : 'window absent from identity';
});

probe('I-3', 'the module computes no hash of its own', () => {
  const hit = /\b(sha1|sha256|md5|createHash|crypto|hashCode|digest)\b/i.exec(SRC);
  return hit === null ? true : `found ${hit[0]}`;
});

probe('I-4', 'CONTROL: the identity detector sees the fields it claims to', () => {
  const m = identityMaterial(buildIdentity(req('SDN', { statedWindow: 'w' })));
  return m.includes('SDN') && m.includes('window:w') && m.includes('HUMANITARIAN')
    ? true
    : `material ${m}`;
});

probe('I-5', 'observation key order and duplicates do not change identity', () => {
  const a = identityMaterial(buildIdentity(req('SDN', { observationKeys: ['b', 'a', 'a'] })));
  const b = identityMaterial(buildIdentity(req('SDN', { observationKeys: ['a', 'b'] })));
  return a === b ? true : 'member order changes identity';
});

probe('I-9', 'buildIdentity is the single normalisation point for observation keys', () => {
  const id = buildIdentity(req('SDN', { observationKeys: ['b', 'a', 'a'] }));
  const keys = [...id.observationKeys];
  const sorted = JSON.stringify(keys) === JSON.stringify([...keys].sort());
  const deduped = new Set(keys).size === keys.length;
  return sorted && deduped ? true : `keys ${keys.join(',')}`;
});

probe('I-6', 'identity fields are separated by U+001F, never concatenated', () => {
  const m = identityMaterial(buildIdentity(req('SDN')));
  return m.includes('\u001F') ? true : 'separator absent';
});

probe('I-7', 'the reader revision is part of identity, so planRevision can invalidate', () => {
  const m = identityMaterial(buildIdentity(req('SDN')));
  return /reader:[^\u001F]+/.test(m) ? true : 'readerRevision absent from identity';
});

probe('I-8', 'the port cannot influence the identity its own answer is cached under', () => {
  const tampering = {
    governed: true,
    read: (r) => ({
      state: 'AVAILABLE',
      assessment: 'RETAINED_REPORTING',
      classified: [
        {
          claim: {
            claim: 'c',
            sources: [{ articleRef: 'x', countryIso3: r.countryIso3 }],
            scope: 'COUNTRY',
            asOfStated: null,
          },
          disclosure: 'READER_SAFE',
        },
      ],
      refusal: null,
      // The port tries to dictate the identity its own answer is cached under.
      identity: { ...buildIdentity(r), countryIso3: 'KEN' },
    }),
  };
  const out = readHumanitarian(tampering, req('SDN'));
  return out.identity.countryIso3 === 'SDN' ? true : `identity became ${out.identity.countryIso3}`;
});

/* ================= S · surface neutrality ======================== */

probe('S-1', 'no surface, role, entitlement or tier symbol appears in src/', () => {
  const hit = /\b(surface|isAdmin|userRole|entitlement|tier|dashboardPublic|isPublic)\b/i.exec(SRC);
  return hit === null ? true : `found ${hit[0]}`;
});

probe('S-2', 'the same request yields a byte-identical result regardless of caller', () => {
  const port = storeFor('GOVERNED_WITH_SDN_ROWS');
  const a = JSON.stringify(readHumanitarian(port, req('SDN')));
  const b = JSON.stringify(readHumanitarian(port, req('SDN')));
  return a === b ? true : 'results differ between callers';
});

probe('S-3', 'CONTROL: the surface detector catches the ordinary form', () => {
  const sample = 'function f(userRole) { return userRole; }';
  return /\b(surface|isAdmin|userRole|entitlement|tier)\b/i.test(sample) ? true : 'detector blind';
});

/* ================= N · no network, no provider, no AI ============ */

probe('N-1', 'src/ holds no network, provider, model or AI symbol', () => {
  const hit = /\b(fetch|axios|https?:|XMLHttpRequest|openai|gpt|anthropic|claude|completion|embedding|copernicus|provider)\b/i.exec(SRC);
  return hit === null ? true : `found ${hit[0]}`;
});

probe('N-2', 'no legacy /analysis/news path appears in src/', () =>
  /analysis\/news/.test(SRC) ? 'legacy path present' : true,
);

probe('N-3', 'CONTROL: the network and legacy detectors catch the ordinary forms', () => {
  const s = 'await fetch("/analysis/news")';
  const net = /\b(fetch|axios|https?:)\b/i.test(s);
  const legacy = /analysis\/news/.test(s);
  return net && legacy ? true : 'detector blind';
});

probe('N-4', 'src/ reads no clock, no randomness and no environment variable', () => {
  const hit = /\b(Date\.now|new Date|Math\.random|process\.env)\b/.exec(SRC);
  return hit === null ? true : `found ${hit[0]}`;
});

/* ================= P · purity ==================================== */

probe('P-1', 'reopening an identical read returns a byte-identical result', () => {
  for (const row of CORPUS) {
    const port = storeFor(row.store);
    const a = JSON.stringify(readHumanitarian(port, row.request));
    const b = JSON.stringify(readHumanitarian(port, row.request));
    if (a !== b) return `${row.id} not idempotent`;
  }
  return true;
});

/* ================= L · language neutrality ======================= */

probe('L-1', 'src/ holds no language, locale or question-text symbol', () => {
  const hit = /\b(language|locale|lang|questionText|rawQuery|translate|\bpl\b)\b/i.exec(SRC);
  return hit === null ? true : `found ${hit[0]}`;
});

probe('L-2', 'a non-English window phrase survives verbatim into identity', () => {
  const w = 'ostatnie 30 dni';
  const m = identityMaterial(buildIdentity(req('SDN', { statedWindow: w })));
  return m.includes(`window:${w}`) ? true : 'window normalised or dropped';
});

probe('L-3', 'CONTROL: the language detector catches the ordinary form', () =>
  /\b(language|locale)\b/i.test('const locale = "pl";') ? true : 'detector blind',
);

/* ================= V · port-contract validation =================== */

probe('V-1', 'an unsourced claim from the port is refused, not served and not trimmed', () => {
  const r = readHumanitarian(UNSOURCED_CLAIM_PORT, req('SDN'));
  return r.state !== 'AVAILABLE' && r.claims.length === 0 && r.refusal === 'READ_CONTRACT_VIOLATION'
    ? true
    : `${r.state}/${String(r.refusal)}/${r.claims.length}`;
});

probe('V-2', 'a scope finer than the producible ceiling is refused', () => {
  const r = readHumanitarian(OVER_PRECISE_PORT, req('SDN'));
  return r.refusal === 'PRECISION_ABOVE_PRODUCIBLE_CEILING' ? true : String(r.refusal);
});

probe('V-3', 'AVAILABLE with no claims becomes NO_DATA_FOR_GEOGRAPHY, never a bare AVAILABLE', () => {
  const r = readHumanitarian(AVAILABLE_BUT_EMPTY_PORT, req('SDN'));
  return r.state === 'NO_DATA_FOR_GEOGRAPHY' && plannableForRead(r) === false
    ? true
    : `${r.state}/${plannableForRead(r)}`;
});

// V-4 was REWRITTEN for R2, not deleted — recorded in docs/05-CHANGED-PROBES.md §4. It asserted
// that an observation key was REFUSED, which was correct while Main had not landed the identity
// and the ruling forbade inventing one. Main has landed it, so the key is now accepted opaquely
// and the guarantee worth keeping is that supplying one neither refuses nor is silently ignored.
probe('V-4', 'an observation key is accepted AND reaches identity, never silently dropped', () => {
  const r = readHumanitarian(storeFor('GOVERNED_WITH_SDN_ROWS'), req('SDN', { observationKeys: ['k'] }));
  if (r.state !== 'AVAILABLE' || r.refusal !== null) return `refused: ${String(r.refusal)}`;
  if (!r.identity.observationKeys.includes('k')) return 'the key was dropped from identity';
  const withKey = identityMaterial(r.identity);
  const without = identityMaterial(buildIdentity(req('SDN')));
  return withKey !== without ? true : 'the key did not change identity';
});

probe('V-5', 'CONTROL: the same governed store serves when no observation key is supplied', () => {
  const r = readHumanitarian(storeFor('GOVERNED_WITH_SDN_ROWS'), req('SDN'));
  return r.state === 'AVAILABLE' && r.claims.length > 0 ? true : `${r.state}/${r.claims.length}`;
});

/* ================= AS · absence-state vocabulary ================== */

probe('AS-1', 'the five accepted absence states plus AVAILABLE, and nothing else', () => {
  const fromUnion = [...AVAILABILITY_FROM_UNION].sort();
  if (JSON.stringify(fromUnion) !== JSON.stringify([...AVAILABILITY_STATES].sort())) {
    return `union/array drift: union ${fromUnion.join(',')}`;
  }
  const want = [
    'AVAILABLE',
    'NOT_BUILT',
    'NOT_CONNECTED',
    'NO_DATA_FOR_GEOGRAPHY',
    'TIER_RESTRICTED',
    'TEMPORARILY_UNAVAILABLE',
  ].sort();
  const got = [...AVAILABILITY_STATES].sort();
  return JSON.stringify(want) === JSON.stringify(got) ? true : `got ${got.join(',')}`;
});

// AS-2 was REWRITTEN, not deleted, and the change is recorded in docs/05-CHANGED-PROBES.md.
// It previously asserted that NOT_ASSESSED appeared nowhere in src/ — correct under the earlier
// reading of C-H2, and obsolete now that Contract 2 §E establishes NOT_ASSESSED as a legitimate
// value on the ASSESSMENT axis. The guarantee worth keeping is that the two axes stay separate:
// NOT_ASSESSED must never become a sixth ABSENCE word.
probe('AS-2', 'NOT_ASSESSED is on the assessment axis only, never an availability state', () => {
  if (AVAILABILITY_STATES.includes('NOT_ASSESSED')) return 'NOT_ASSESSED is an availability state';
  if (AVAILABILITY_FROM_UNION.includes('NOT_ASSESSED')) return 'present in the availability union';
  if (!ASSESSMENT_STATES.includes('NOT_ASSESSED')) return 'absent from the assessment axis';
  return true;
});

probe('AS-3', 'today the measured state is NOT_CONNECTED, not NOT_BUILT', () => {
  const r = readHumanitarian(storeFor('UNBOUND_NO_GOVERNED_BINDING'), req('SDN'));
  return r.state === 'NOT_CONNECTED' ? true : String(r.state);
});

/* ================= AX · the assessment axis (Contract 2 §E) ======= */

probe('AX-1', 'every result carries an assessment, and it is the single mapping', () => {
  for (const row of CORPUS) {
    const r = readHumanitarian(storeFor(row.store), row.request);
    if (!ASSESSMENT_STATES.includes(r.assessment)) return `${row.id} assessment ${r.assessment}`;
    if (r.assessment !== assessmentFor(r.state)) return `${row.id} off-mapping ${r.assessment}`;
  }
  return true;
});

probe('AX-2', 'an unreachable store is SOURCE_UNAVAILABLE, never NOT_ASSESSED', () => {
  // The programme rule this guards: "NOT_ASSESSED must never silently become nothing happened."
  // Reporting "no source assessed this" when the truth is "we could not look" is that collapse.
  for (const s of ['NOT_CONNECTED', 'TEMPORARILY_UNAVAILABLE', 'TIER_RESTRICTED', 'NOT_BUILT']) {
    if (assessmentFor(s) === 'NOT_ASSESSED') return `${s} mapped to NOT_ASSESSED`;
  }
  const r = readHumanitarian(storeFor('UNBOUND_NO_GOVERNED_BINDING'), req('SDN'));
  return r.assessment === 'SOURCE_UNAVAILABLE' ? true : String(r.assessment);
});

probe('AX-3', 'CURRENT_PROVIDER_OBSERVATION is unreachable from this adapter', () => {
  const ports = [
    storeFor('UNBOUND_NO_GOVERNED_BINDING'),
    storeFor('GOVERNED_WITH_SDN_ROWS'),
    storeFor('GOVERNED_EMPTY_FOR_GEOGRAPHY'),
    storeFor('GOVERNED_READ_FAILING'),
    UNSOURCED_CLAIM_PORT,
    OVER_PRECISE_PORT,
    AVAILABLE_BUT_EMPTY_PORT,
  ];
  for (const p of ports) {
    for (const iso of ['SDN', 'KEN']) {
      const r = readHumanitarian(p, req(iso));
      if (ASSESSMENT_UNREACHABLE_HERE.includes(r.assessment)) {
        return `adapter claimed ${r.assessment} — it performs no provider read`;
      }
    }
  }
  return true;
});

probe('AX-4', 'NOT_ASSESSED never accompanies a claim', () => {
  for (const row of CORPUS) {
    const r = readHumanitarian(storeFor(row.store), row.request);
    if (r.assessment === 'NOT_ASSESSED' && r.claims.length > 0) return `${row.id} carries content`;
  }
  return true;
});

probe('AX-5', 'CONTROL: the assessment mapping is total over the availability states', () => {
  for (const s of AVAILABILITY_STATES) {
    if (!ASSESSMENT_STATES.includes(assessmentFor(s))) return `${s} unmapped`;
  }
  return true;
});


/* ================= DG · the disclosure guard ====================== */

probe('DG-1', 'the canary in withheld evidence reaches NONE of the five sinks', () => {
  // The proof that matters. Serialise every sink payload of every row and look for the token
  // that only non-reader-safe claims carry.
  for (const row of CORPUS) {
    const r = readHumanitarian(storeFor(row.store), row.request);
    for (const sink of DISCLOSURE_SINKS) {
      const blob = JSON.stringify(r.sinks[sink] ?? null);
      if (blob.includes(LEAK_CANARY)) return `${row.id} leaked into ${sink}`;
    }
    // Also the reader-safe claim list and the whole result envelope.
    if (JSON.stringify(r.claims).includes(LEAK_CANARY)) return `${row.id} leaked into claims`;
    if (JSON.stringify(r).includes(LEAK_CANARY)) return `${row.id} leaked into the result envelope`;
  }
  return true;
});

probe('DG-2', 'CONTROL: the canary IS present upstream, so DG-1 is not vacuous', () => {
  const out = storeFor('GOVERNED_MIXED_DISCLOSURE').read({
    countryIso3: 'SDN',
    questionKind: 'CURRENT_STATUS',
  });
  const upstream = JSON.stringify(out.classified);
  if (!upstream.includes(LEAK_CANARY)) return 'the fixture no longer carries a canary';
  const blocked = out.classified.filter((c) => c.disclosure !== 'READER_SAFE').length;
  return blocked === 3 ? true : `expected 3 blocked claims upstream, saw ${blocked}`;
});

probe('DG-3', 'only READER_SAFE is admissible, and the rule is not per-sink', () => {
  const admitted = DISCLOSURE_CLASSES.filter(admissibleToSink);
  return admitted.length === 1 && admitted[0] === 'READER_SAFE' ? true : admitted.join(',');
});

probe('DG-4', 'the audit count never appears inside a sink payload', () => {
  const r = readHumanitarian(storeFor('GOVERNED_MIXED_DISCLOSURE'), req('SDN'));
  if (r.withheldTotal !== 3) return `audit count wrong: ${r.withheldTotal}`;
  for (const sink of DISCLOSURE_SINKS) {
    const blob = JSON.stringify(r.sinks[sink] ?? null);
    if (/withheld|INTERNAL_ONLY|PROTECTED_LOCATION/i.test(blob)) return `${sink} carries audit data`;
  }
  return true;
});

probe('DG-5', 'every refusal hands every sink nothing', () => {
  for (const row of CORPUS) {
    const r = readHumanitarian(storeFor(row.store), row.request);
    if (r.state === 'AVAILABLE') continue;
    for (const sink of DISCLOSURE_SINKS) {
      const v = r.sinks[sink];
      if (Array.isArray(v) ? v.length > 0 : v != null) return `${row.id} ${sink} non-empty`;
    }
  }
  return true;
});

probe('DG-6', 'STATED LIMIT: classification is trusted, so a MISLABELLED claim is served', () => {
  // This probe records a real limitation rather than hiding it. The guard is label-driven: it
  // cannot detect evidence whose disclosure class is wrong upstream, and it does NOT attempt
  // content-based re-classification, because guessing at protectedness from text would be its
  // own fabrication. Correct classification is the retained store's responsibility.
  // If this probe ever FAILS, the guard has started second-guessing labels and that is a
  // behaviour change needing a ruling, not a silent improvement.
  const r = readHumanitarian(MISLABELLED_PORT, req('SDN'));
  return r.claims.length === 1 && r.withheldTotal === 0
    ? true
    : `guard re-classified: claims ${r.claims.length}, withheld ${r.withheldTotal}`;
});

probe('DG-7', 'the adapter attempts no content-based re-classification', () => {
  // Backs DG-6: no regex literal and no text-scanning construct over claim text in src/.
  const hit = /\.test\(|\.match\(|\bRegExp\b|\/[a-z].*\/[gimsuy]*\.exec/.exec(SRC);
  return hit === null ? true : `found ${hit[0]}`;
});

/* ================= OK · Main's observationKey, opaquely =========== */

probe('OK-1', 'no key, one key and two keys are three distinct identities', () => {
  const none = identityMaterial(buildIdentity(req('SDN')));
  const one = identityMaterial(buildIdentity(req('SDN', { observationKeys: ['hum:sdn:flood:2026-09'] })));
  const two = identityMaterial(
    buildIdentity(req('SDN', { observationKeys: ['hum:sdn:flood:2026-09', 'hum:sdn:displacement:2026-09'] })),
  );
  const set = new Set([none, one, two]);
  return set.size === 3 ? true : `only ${set.size} distinct identities`;
});

probe('OK-2', 'no key-parsing construct exists in src/ — the key is opaque', () => {
  const hit = /\.split\(|\.slice\(|\.substring\(|\.toLowerCase\(|\.toUpperCase\(|parseInt|Number\(/.exec(SRC);
  return hit === null ? true : `found ${hit[0]}`;
});

probe('OK-3', 'the retired R1 refusal code is emitted by no code path', () => {
  for (const row of CORPUS) {
    const r = readHumanitarian(storeFor(row.store), row.request);
    if (r.refusal === 'OBSERVATION_KEY_CONSTRUCT_ABSENT') return `${row.id} still emits it`;
  }
  const r = readHumanitarian(storeFor('GOVERNED_WITH_SDN_ROWS'), req('SDN', { observationKeys: ['k'] }));
  return r.state === 'AVAILABLE' ? true : `a key was refused: ${String(r.refusal)}`;
});

/* ================= BP · the registration predicate ================ */

const CLEARED = 'CLEARED_FOR_ALPHA_RUNTIME';

probe('BP-1', "today's measured inputs fail all three conjuncts and bind nothing", () => {
  const b = resolveSpecialistBinding(MEASURED_INPUTS_TODAY);
  if (b.registered || b.bound) return 'bound on blocked inputs';
  if (b.refusedBecause.length !== 3) return `reported ${b.refusedBecause.length} reasons, want 3`;
  return b.askTerminal === 'CAPABILITY_UNAVAILABLE' ? true : String(b.askTerminal);
});

probe('BP-2', 'ONLY CLEARED_FOR_ALPHA_RUNTIME reader-clears a source', () => {
  const ok = E1_CLEARANCES.filter(readerClears);
  if (ok.length !== 1 || ok[0] !== CLEARED) return `reader-clears: ${ok.join(',')}`;
  // The specific confusion worth naming: dev capture is not reader disclosure.
  return readerClears('CLEARED_FOR_DEV_CAPTURE') ? 'dev capture reader-cleared' : true;
});

probe('BP-3', 'each conjunct alone blocks binding', () => {
  const base = { readerSafeRetainedDataExists: true, clearance: CLEARED, governed: true };
  const cases = [
    ['NOT_GOVERNED', { ...base, governed: false }],
    ['NO_READER_SAFE_RETAINED_DATA', { ...base, readerSafeRetainedDataExists: false }],
    ['SOURCE_NOT_READER_CLEARED', { ...base, clearance: 'CLEARED_FOR_DEV_CAPTURE' }],
  ];
  for (const [reason, inputs] of cases) {
    const b = resolveSpecialistBinding(inputs);
    if (b.registered) return `${reason} still registered`;
    if (!b.refusedBecause.includes(reason)) return `${reason} not reported`;
    if (b.askTerminal !== 'CAPABILITY_UNAVAILABLE') return `${reason} terminal ${b.askTerminal}`;
  }
  return true;
});

probe('BP-4', 'CONTROL: all three conjuncts satisfied binds the tool', () => {
  const b = resolveSpecialistBinding({
    readerSafeRetainedDataExists: true,
    clearance: CLEARED,
    governed: true,
  });
  return b.registered && b.bound && b.availability === 'AVAILABLE' && b.askTerminal === null
    ? true
    : JSON.stringify(b);
});

probe('BP-5', 'CAPABILITY_UNAVAILABLE is the only Ask terminal this lane emits', () => {
  if (/PLAN_NOT_SATISFIABLE|INSUFFICIENT_EVIDENCE/.test(SRC)) return 'a competing terminal appears in src/';
  for (const row of CORPUS) {
    const r = readHumanitarian(storeFor(row.store), row.request);
    if (r.askTerminal !== null && r.askTerminal !== 'CAPABILITY_UNAVAILABLE') {
      return `${row.id} terminal ${r.askTerminal}`;
    }
  }
  return true;
});

probe('BP-6', "E1's measured R2 matrix contains no reader-cleared source", () => {
  const cleared = readerClearedSourceIds();
  if (cleared.length !== 0) return `reader-cleared: ${cleared.join(',')}`;
  // And the specific R2 change worth pinning: GDACS is no longer a dev-capture clearance.
  return E1_MEASURED_MATRIX_R2.GDACS === 'RIGHTS_CONFIRMATION_REQUIRED'
    ? true
    : `GDACS verdict ${E1_MEASURED_MATRIX_R2.GDACS}`;
});

probe('BP-7', "today's inputs name the GATE, not a generic NOT_CLEARED", () => {
  // R1 reported NOT_CLEARED, which hid which authority stands in the way. The gate decides who
  // can unblock it: rights is a Product Owner question, protection is E1's, credentials are F's.
  return MEASURED_INPUTS_TODAY.clearance === 'RIGHTS_CONFIRMATION_REQUIRED'
    ? true
    : String(MEASURED_INPUTS_TODAY.clearance);
});

/* ================= XD · cross-domain identity ===================== */

const HUM = { domainId: 'HUMANITARIAN', identity: 'hum:SDN', requiredness: 'REQUIRED' };
const CONF = { domainId: 'CONFLICT', identity: 'conf:SDN', requiredness: 'REQUIRED' };
const GEO = { domainId: 'GEOGRAPHY', identity: 'geo:typed:SDN', requiredness: 'SUPPLEMENTARY' };
const GEO2 = { domainId: 'GEOGRAPHY', identity: 'geo:typed:KEN', requiredness: 'SUPPLEMENTARY' };
const STORY = { domainId: 'RETAINED_STORY', identity: 'story:abc', requiredness: 'SUPPLEMENTARY' };

probe('XD-1', 'leg ORDER does not change composite identity', () => {
  const a = compositeIdentityMaterial([HUM, CONF, GEO]);
  const b = compositeIdentityMaterial([GEO, HUM, CONF]);
  return a === b ? true : 'order changes identity';
});

probe('XD-2', 'leg MEMBERSHIP always changes composite identity', () => {
  const full = compositeIdentityMaterial([HUM, CONF, GEO]);
  for (const dropped of [[HUM, CONF], [HUM, GEO], [CONF, GEO]]) {
    if (compositeIdentityMaterial(dropped) === full) return 'a dropped leg left identity unchanged';
  }
  return true;
});

probe('XD-3', 'Conflict + Humanitarian differs from Conflict alone', () => {
  return compositeIdentityMaterial([CONF, HUM]) !== compositeIdentityMaterial([CONF])
    ? true
    : 'adding a humanitarian leg did not change identity';
});

probe('XD-4', 'geography + Humanitarian separates by geography leg', () => {
  const a = compositeIdentityMaterial([HUM, GEO]);
  const b = compositeIdentityMaterial([HUM, GEO2]);
  return a !== b ? true : 'two geographies share an identity';
});

probe('XD-5', 'retained story + Humanitarian differs from Humanitarian alone', () => {
  return compositeIdentityMaterial([HUM, STORY]) !== compositeIdentityMaterial([HUM])
    ? true
    : 'a story anchor did not change identity';
});

probe('XD-6', 'a REQUIRED humanitarian leg forbids reporting substitution', () => {
  if (!substitutionForbidden([HUM, CONF])) return 'substitution permitted for a required leg';
  const supp = [{ ...HUM, requiredness: 'SUPPLEMENTARY' }];
  return substitutionForbidden(supp) ? 'forbidden for a supplementary leg too' : true;
});

probe('XD-7', 'the contributing domain set is sorted and deduplicated', () => {
  const d = contributingDomains([GEO, HUM, CONF, HUM]);
  return JSON.stringify(d) === JSON.stringify(['CONFLICT', 'GEOGRAPHY', 'HUMANITARIAN'])
    ? true
    : d.join(',');
});

probe('XD-8', 'the OUTER composite encoding is separated, not concatenated', () => {
  // Tightened after MU-35 survived: the per-leg encoding already contains U+001F, so an
  // `.includes` check passed even when the outer join was ''. The guarantee that matters is that
  // the leg count and each leg are separated from one another, which is what prevents
  // ('legs:2' + legA + legB) colliding with a different decomposition.
  const m = compositeIdentityMaterial([HUM, CONF]);
  if (!m.startsWith(`legs:2\u001F`)) return 'the leg count is not separated from the legs';
  const fields = m.split('\u001F');
  return fields.length === 1 + 2 * 3 ? true : `expected 7 separated fields, saw ${fields.length}`;
});

/* ================= SA · one specialist, both surfaces ============= */

probe('SA-1', 'Standalone and Alpha produce byte-identical results INCLUDING sink payloads', () => {
  const standalone = CORPUS.find((r) => r.id === 'R2-DG1-mixed-disclosure-serves-only-safe');
  const alpha = CORPUS.find((r) => r.id === 'R2-SA1-standalone-and-alpha-identical');
  if (!standalone || !alpha) return 'the paired rows are missing';
  if (standalone.surface === alpha.surface) return 'the pair no longer spans two surfaces';
  const a = JSON.stringify(readHumanitarian(storeFor(standalone.store), standalone.request));
  const b = JSON.stringify(readHumanitarian(storeFor(alpha.store), alpha.request));
  return a === b ? true : 'the two surfaces disagree';
});

probe('SA-2', 'the guard cannot be laxer on one surface — there is no surface input at all', () => {
  // NOTE on scope: `CLEARED_FOR_ALPHA_RUNTIME` is E1's clearance vocabulary, not a surface
  // parameter, so the clearance names are excluded before scanning. The earlier form of this
  // probe matched that constant and failed — a detector too broad to be true, corrected rather
  // than the code bent to fit it.
  const scanned = SRC.replace(/CLEARED_FOR_ALPHA_RUNTIME|CLEARED_FOR_DEV_CAPTURE/g, '');
  const hit = /\b(surface|callerSurface|isDashboard|isStandalone|dashboardPublic|isAlpha|viewer)\b/i.exec(scanned);
  return hit === null ? true : `found ${hit[0]} in src/`;
});

/* ================= NS · no second system ========================= */

probe('NS-1', 'no second chat, history, conversation or quota system in src/', () => {
  const hit = /\b(conversation|chatHistory|messageHistory|quota|credit|sand|charge|billing|turnId|threadId)\b/i.exec(SRC);
  return hit === null ? true : `found ${hit[0]}`;
});

probe('NS-2', 'CONTROL: the second-system detector catches the ordinary form', () =>
  /\b(conversation|quota)\b/i.test('const quota = 5;') ? true : 'detector blind',
);

/* ================= M · self-audit ================================ */

probe('M-1', 'every absence probe family carries a control', () => {
  const ids = results.map((r) => r.id);
  const needControl = [
    ['I-3', 'I-4'],
    ['S-1', 'S-3'],
    ['N-1', 'N-3'],
    ['N-2', 'N-3'],
    ['L-1', 'L-3'],
    ['A-1', 'A-2'],
    ['B-1', 'B-2'],
    ['V-4', 'V-5'],
    ['I-5', 'I-9'],
    ['AX-2', 'AX-5'],
    ['DG-1', 'DG-2'],
    ['NS-1', 'NS-2'],
    ['BP-3', 'BP-4'],
    ['DG-6', 'DG-7'],
  ];
  for (const [absence, control] of needControl) {
    if (!ids.includes(absence) || !ids.includes(control)) return `${absence} lost its control ${control}`;
    const c = results.find((r) => r.id === control);
    if (!c.ok) return `control ${control} is failing, so ${absence} is unproven`;
  }
  return true;
});

/* ================= report ======================================== */

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(5)}  ${r.what}${r.detail ? '  [' + r.detail + ']' : ''}`);
}
console.log('');
console.log(`PROBES ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`);
if (failed.length > 0) process.exitCode = 1;

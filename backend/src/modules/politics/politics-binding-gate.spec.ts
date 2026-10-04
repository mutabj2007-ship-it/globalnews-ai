/**
 * POLITICS BINDING GATE — measured against d9208933c6ec758756b3b1019d8d01aa1f7592d1.
 *
 * Lane: Claude C. PROPOSED. Complements `politics-no-person-channel.spec.ts`, which already covers
 * the store side; nothing here duplicates it.
 *
 * Every assertion PASSES on d920893, because the measured truth is that Politics is not bound. The
 * gate flips when the five false preconditions become true — by changing the code, never by editing
 * an expectation here.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  MEASURED_AFTER_TEXT_SEAM_WIRING,
  MEASURED_AT_D920893,
  assertEntityRefAdmissible,
  assertNoNameStringMatching,
  decidePoliticsBinding,
  FORBIDDEN_NAME_CHANNELS,
} from '../../../../shared/src/politics/ask-binding.contract';

const BACKEND = join(__dirname, '../../..');
const MOD = join(BACKEND, 'src/modules');
const read = (p: string) => readFileSync(join(MOD, p), 'utf8');
/** Comments may (and do) state a prohibition; only code counts. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('the gate reflects the measured base', () => {
  it('Politics is NOT bound, and names all five outstanding preconditions', () => {
    const d = decidePoliticsBinding(MEASURED_AT_D920893);
    expect(d.bound).toBe(false);
    expect(d.unboundStatus).toBe('NOT_ASSESSED');
    expect([...d.refusedBecause].sort()).toEqual(
      [
        'CONTRIBUTOR_NOT_SELECTABLE',
        'DISCLOSURE_CODE_UNRECOGNISED',
        'LEAK_PROBES_NOT_PASSED',
        'PROJECTION_HAS_NO_CONSUMER',
        'REPOSITORY_NOT_INJECTED',
      ].sort(),
    );
  });

  it('CONTROL: all preconditions satisfied binds — the gate is not a constant', () => {
    const all = { ...MEASURED_AT_D920893, searchableProjectionHasNonSpecConsumer: true,
      repositoryInjectedIntoCoordinator: true, contributorSelectable: true,
      everyEmittedDisclosureRecognised: true, leakProbesPass: true };
    expect(decidePoliticsBinding(all).bound).toBe(true);
  });

  it('an unbound Politics leg reports NOT_ASSESSED, never NO_DATA', () => {
    // NO_DATA asserts a governed read found nothing. An unbound reader performed no read at all,
    // and reporting no-data for it is how "we did not look" becomes "nothing happened".
    expect(decidePoliticsBinding(MEASURED_AT_D920893).unboundStatus).toBe('NOT_ASSESSED');
  });
});

describe('the seam is genuinely unbound in the tree — these fail the moment it is wired', () => {
  const coordinator = read('ask-intelligence/ask-specialist-read.coordinator.ts');
  const selection = read('ask-intelligence/contributor-selection.ts');
  const intelModule = read('ask-intelligence/ask-intelligence.module.ts');

  it('PINNABLE_MODULES does not yet carry POLITICS', () => {
    expect(code(coordinator)).toMatch(/PINNABLE_MODULES\s*=\s*\[[^\]]*\]/);
    expect(/PINNABLE_MODULES\s*=\s*\[[^\]]*'POLITICS'/.test(code(coordinator))).toBe(false);
  });

  it('boundSpecialistDomains does not yet return POLITICS', () => {
    const body = code(coordinator).match(/boundSpecialistDomains\(\)[^{]*\{([\s\S]*?)\n\s{2}\}/)?.[1] ?? '';
    expect(body).toContain('CONFLICT');
    expect(body).not.toContain('POLITICS');
  });

  /*
   * INTEGRATOR (Claude Code), POLITICS INTEL R1 binding: C's two tripwires "the coordinator does not yet
   * inject a Politics repository" and "selectContributors has no POLITICS branch yet" FLIPPED when the
   * authorized text-path seam (C's edits 4–8) was wired. They are restated as positive assertions of the
   * wired state, against MEASURED_AFTER_TEXT_SEAM_WIRING. The pin path (edits 1–3) and the bound
   * declaration (edit 9) are deliberately NOT wired, so the two tripwires above still hold.
   */
  it('WIRED (text seam): the coordinator injects the Politics repository and the module provides it directly', () => {
    expect(code(coordinator)).toMatch(/PoliticsObservationRepository/);
    expect(code(intelModule)).toMatch(/PoliticsObservationRepository/);
    expect(MEASURED_AFTER_TEXT_SEAM_WIRING.repositoryInjectedIntoCoordinator).toBe(true);
  });

  it('WIRED (text seam): selectContributors has a POLITICS branch', () => {
    expect(code(selection)).toMatch(/contributorId:\s*'POLITICS'/);
    expect(MEASURED_AFTER_TEXT_SEAM_WIRING.contributorSelectable).toBe(true);
  });

  it('after text-seam wiring the gate still refuses to BIND, naming only disclosure and leak probes', () => {
    const d = decidePoliticsBinding(MEASURED_AFTER_TEXT_SEAM_WIRING);
    expect(d.bound).toBe(false);
    expect([...d.refusedBecause].sort()).toEqual(['DISCLOSURE_CODE_UNRECOGNISED', 'LEAK_PROBES_NOT_PASSED']);
  });

  it('AskIntelligenceModule must NOT import PoliticsModule when it is wired', () => {
    // The module's own header: it provides read repositories DIRECTLY "so no controller, no Conflict
    // producer and no Market scheduler/adapter enters this graph". PoliticsModule carries
    // @Controller('politics/observations') and politics.producer.ts, so importing it would pull both in.
    expect(code(intelModule)).not.toMatch(/PoliticsModule/);
  });
});

describe('open producer / closed consumer — the defect Politics must not repeat', () => {
  it('every disclosure code the coordinator emits is recognised by the governed prompt', () => {
    const coordinator = code(read('ask-intelligence/ask-specialist-read.coordinator.ts'));
    const governed = code(read('ask-intelligence/governed-answer.ts'));
    const emitted = [...coordinator.matchAll(/disclosures:\s*\[([^\]]*)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/'([A-Z0-9_]+)'/g)].map((x) => x[1]));
    const recognised = [...governed.matchAll(/code === '([A-Z0-9_]+)'/g)].map((m) => m[1]);
    const unrecognised = [...new Set(emitted)].filter((c) => !recognised.includes(c));

    // MEASURED ON d920893: HUMANITARIAN_NOT_ASSESSED is emitted and not recognised. This test is
    // therefore EXPECTED TO FAIL on the base, and that failure is the finding — an emitted code no
    // consumer can act on is a defect at the emitting lane. It is written as a real assertion rather
    // than a comment so it cannot be forgotten; mark it `.failing` only with a CTO ruling.
    expect(unrecognised).toEqual([]);
  });

  it('no POLITICS_* disclosure code is emitted before the governed prompt recognises it', () => {
    const coordinator = code(read('ask-intelligence/ask-specialist-read.coordinator.ts'));
    const governed = code(read('ask-intelligence/governed-answer.ts'));
    const politicsEmitted = [...coordinator.matchAll(/'(POLITICS_[A-Z0-9_]+)'/g)].map((m) => m[1]);
    for (const c of politicsEmitted) expect(governed).toContain(`code === '${c}'`);
  });
});

describe('E1-POL-8 — the entityRef join, uncovered by the existing politics spec', () => {
  it('a handle derived from any free-text name channel is refused', () => {
    for (const ch of FORBIDDEN_NAME_CHANNELS) {
      expect(() =>
        assertEntityRefAdmissible({ provenance: 'GOVERNED_PARTICIPANT_SURFACE', derivedFromChannel: ch }),
      ).toThrow(/ENTITY_REF_DERIVED_FROM_NAME_CHANNEL/);
    }
  });

  it('shape is not provenance — a well-formed ungoverned handle is refused', () => {
    expect(() =>
      assertEntityRefAdmissible({ provenance: 'UNGOVERNED', derivedFromChannel: null }),
    ).toThrow(/ENTITY_REF_NOT_FROM_GOVERNED_SURFACE/);
  });

  it('CONTROL: a governed handle with no name-channel origin is admitted', () => {
    expect(() =>
      assertEntityRefAdmissible({ provenance: 'GOVERNED_PARTICIPANT_SURFACE', derivedFromChannel: null }),
    ).not.toThrow();
  });

  it('name-string matching is refused outright', () => {
    expect(() => assertNoNameStringMatching('dedupe participants by name')).toThrow(
      /NAME_STRING_MATCHING_FORBIDDEN/,
    );
  });
});

describe('the people channel stays out of the BINDING path, which the politics spec does not scan', () => {
  // politics-no-person-channel.spec.ts scans backend/src/modules/politics only. The binding code
  // will live in ask-intelligence / ask-v2 / ask-router, so that scan cannot see it.
  const DIRS = ['ask-intelligence', 'ask-v2', 'ask-router'];

  it('no non-spec source in the Ask binding path reaches the people channel', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(MOD, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) { walk(rel); continue; }
        if (!e.name.endsWith('.ts') || e.name.endsWith('.spec.ts')) continue;
        const text = code(readFileSync(join(MOD, rel), 'utf8'));
        if (/entities\.people|extractTitledPeople|PERSON_TITLES|article-entities\.util/.test(text)) {
          hits.push(rel);
        }
      }
    };
    for (const d of DIRS) walk(d);
    expect(hits).toEqual([]);
  });

  it('CONTROL: the detector finds the channel where it really lives', () => {
    const analysis = code(readFileSync(join(MOD, 'analysis/validation/validate-analysis-result.ts'), 'utf8'));
    expect(/people/.test(analysis)).toBe(true);
  });
});

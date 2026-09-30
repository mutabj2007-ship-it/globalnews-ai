import { readFileSync } from 'fs';
import { join } from 'path';
import { adminEn } from '@/lib/i18n/dictionaries/adminEn';
import { adminPl } from '@/lib/i18n/dictionaries/adminPl';

/**
 * ADMIN OPERATIONS R1 — properties of the screen that a rendering test would
 * not catch, asserted over its source and its copy.
 *
 * The screen's whole job is to not mislead someone mid-incident, so the
 * assertions here are about what it must never do: claim success before the
 * server says so, render an unreadable store as healthy, or draw a control for
 * something that has no enforcement.
 */
const SOURCE = readFileSync(join(__dirname, 'screens/IncidentControlsScreen.tsx'), 'utf8');
const HOOK = readFileSync(join(__dirname, '../../lib/admin/useAdminOperations.ts'), 'utf8');

describe('ADMIN OPERATIONS R1 — the incident screen', () => {
  it('is gated on a capability before it asks the server for anything', () => {
    const gate = SOURCE.indexOf("can('analytics.view')");
    /* The CALL SITE, not the import line — the import is naturally at the top. */
    const callSite = SOURCE.indexOf('useAdminResource<AdminOperationsState>(');
    expect(gate).toBeGreaterThan(-1);
    expect(callSite).toBeGreaterThan(-1);
    /* The hook lives in the child component, so "not authorized" means "never asked". */
    expect(callSite).toBeGreaterThan(gate);
    expect(SOURCE.slice(0, gate)).not.toContain('useAdminResource<AdminOperationsState>(');
  });

  it('NEVER CLAIMS SUCCESS OPTIMISTICALLY — it renders the server-confirmed result', () => {
    expect(SOURCE).toContain('lastResultApplied');
    /* The confirmation text is chosen from the server's `applied`, not from a local flag. */
    expect(SOURCE).toContain(
      'lastResultApplied ? screen.result.saved : screen.result.notConfirmed',
    );
    expect(HOOK).toContain('A FAILURE NEVER BECOMES A SUCCESS');
    expect(HOOK).toContain('if (!response.ok)');
  });

  it('refuses a second submit while one is in flight, using a ref rather than state', () => {
    expect(HOOK).toContain('inFlight');
    expect(HOOK).toContain('useRef');
    expect(HOOK).toContain('if (inFlight.current) return false;');
  });

  it('re-reads the server after every attempt, so a refusal cannot leave a stale view', () => {
    expect(SOURCE).toContain('resource.reload()');
  });

  it('SHOWS EFFECTIVE AND REQUESTED SEPARATELY, and never derives one from the other', () => {
    expect(SOURCE).toContain('screen.state.effective');
    expect(SOURCE).toContain('screen.state.requested');
    expect(SOURCE).toContain('screen.state.deployment');
  });

  it('renders an unreadable store with its own tone, never as a healthy state', () => {
    expect(SOURCE).toContain("row.readable ? 'info' : 'bad'");
    expect(SOURCE).toContain('screen.state.unreadable');
  });

  it('offers the action opposite to the EFFECTIVE state, not the requested one', () => {
    expect(SOURCE).toContain('const nextEnabled = !row.effective;');
  });

  it('requires a reason before the apply button is usable', () => {
    expect(SOURCE).toContain("disabled={reasonTooShort || writeState === 'pending'}");
  });

  it('DRAWS NO CONTROL FOR UNAVAILABLE WORK — monitoring and delivery are text only', () => {
    const notHere = SOURCE.slice(SOURCE.indexOf('screen.notHere.heading'));
    const block = notHere.slice(0, 500);
    expect(block).toContain('screen.notHere.monitoring');
    expect(block).toContain('screen.notHere.providers');
    expect(block).not.toContain('<button');
  });

  it('constructs no bare fetch and no hardcoded /admin path', () => {
    expect(SOURCE).not.toMatch(/\bfetch\(/);
    expect(HOOK).not.toMatch(/\bfetch\(/);
    expect(SOURCE).not.toMatch(/'\/admin\//);
  });
});

describe('ADMIN OPERATIONS R1 — the copy an operator reads', () => {
  const en = adminEn.screens.incidentControls;
  const pl = adminPl.screens.incidentControls;

  it('EN and PL declare the same keys, at every level used by the screen', () => {
    const keys = (value: unknown): string[] =>
      typeof value === 'object' && value !== null
        ? Object.entries(value as Record<string, unknown>)
            .flatMap(([key, inner]) => [key, ...keys(inner).map((k) => `${key}.${k}`)])
            .sort()
        : [];
    expect(keys(pl)).toEqual(keys(en));
  });

  it('the pause copy states that saved answers remain readable', () => {
    expect(en.controls.pauseNewAiAnswers.consequence.toLowerCase()).toContain(
      'saved answers stay readable',
    );
    expect(en.health.savedReadable.toLowerCase()).toContain('saved answers');
  });

  it('IT DOES NOT PROMISE CANCELLATION — the switch gates admission, not in-flight work', () => {
    const consequence = en.controls.pauseNewAiAnswers.consequence.toLowerCase();
    expect(consequence).toContain('already running will finish');
    expect(consequence).toContain('does not cancel');
  });

  it('the second control is described by what it actually does, not as a surface takedown', () => {
    const copy = en.controls.stopAskR2Execution;
    expect(copy.name).toBe('Stop Ask R2 execution');
    const consequence = copy.consequence.toLowerCase();
    /* Verified: ASK_R2_ENABLED is read only inside the executor. No guard reads it,
       and the Ask surface is gated by a different, deploy-only variable. */
    expect(consequence).toContain('surface stays reachable');
    expect(consequence).not.toContain('unavailability');
    expect(copy.note.toLowerCase()).toContain('the same as pausing new ai answers');
  });

  it('each control names how to reverse it', () => {
    expect(en.controls.pauseNewAiAnswers.reverse.toLowerCase()).toContain('same control');
    expect(en.controls.stopAskR2Execution.reverse.toLowerCase()).toContain('same control');
  });

  it('the unconfirmed-environment copy says controls are disabled, not merely that the label is missing', () => {
    expect(en.environment.unconfirmedNotSet.toLowerCase()).toContain('disabled');
    expect(en.environment.nodeEnvNote.toLowerCase()).toContain('never used as the label');
  });

  it('THE PROPAGATION COPY CARRIES NO HARD-CODED MEASUREMENT, and promises nothing instant', () => {
    const copy = en.result.propagation.toLowerCase();
    expect(copy).toContain('a few seconds');
    expect(copy).not.toContain('immediate');
    expect(copy).not.toContain('instant');
    /* A number here would go stale the moment ASK_FLAG_CACHE_MS changes. The measured
       bound belongs in the evidence, not in the product copy. */
    expect(copy).not.toMatch(/\b\d+(\.\d+)?\s*(ms|s\b|seconds)/);
    expect(copy).not.toContain('five');
  });

  it('IT SAYS THE SETTING IS SAVED, NEVER THAT EVERY INSTANCE HAS APPLIED IT', () => {
    expect(en.result.saved.toLowerCase()).toContain('saved');
    expect(en.result.notUniversal.toLowerCase()).toContain(
      'not a report that every running instance',
    );
    expect(SOURCE).toContain('screen.result.notUniversal');
  });

  it('the propagation copy also states that running requests are unaffected', () => {
    expect(en.result.propagation.toLowerCase()).toContain('already running are not affected');
  });

  it('THE PRIMARY CONTROL IS THE COMPUTE SWITCH, and the R2 control sits behind a disclosure', () => {
    expect(SOURCE).toContain("row.labelKey === 'pauseNewAiAnswers'");
    expect(SOURCE).toContain('<details');
    expect(SOURCE).toContain('<summary');
    expect(SOURCE).toContain('screen.advanced.heading');
  });

  it('the advanced control explains when an operator would need it beyond the compute switch', () => {
    const when = en.controls.stopAskR2Execution.whenToUse.toLowerCase();
    expect(when).toContain('only when the r2 executor itself is the problem');
    expect(when).toContain('use pause new ai answers instead');
  });

  it('NEITHER CONTROL IS DESCRIBED AS HIDING OR TAKING DOWN THE ASK SURFACE', () => {
    const all = [
      en.controls.pauseNewAiAnswers.consequence,
      en.controls.stopAskR2Execution.consequence,
      en.controls.stopAskR2Execution.whenToUse,
      en.controls.stopAskR2Execution.note,
    ]
      .join(' ')
      .toLowerCase();
    [
      'take down',
      'takes down',
      'hide the ask',
      'hides the ask',
      'unavailability',
      'remove the ask',
    ].forEach((forbidden) => expect(all).not.toContain(forbidden));
    expect(en.controls.stopAskR2Execution.consequence.toLowerCase()).toContain(
      'surface stays reachable',
    );
  });
});

/**
 * ADMIN OPERATIONS R1 — keyboard access.
 *
 * The wider admin stylesheet defines no focus rules at all, so an operator tabbing to a
 * control would otherwise get only the browser default ring on a dark ground. This screen
 * sets its own on every interactive element. The gap elsewhere on the admin surface is
 * reported rather than fixed here.
 */
describe('ADMIN OPERATIONS R1 — keyboard access', () => {
  it('every interactive element carries a visible focus state', () => {
    const interactive = SOURCE.match(/<(button|input|summary)\b[^>]*>/g) ?? [];
    expect(interactive.length).toBeGreaterThanOrEqual(4);
    /* className may sit on a following line, so check the element's whole block. */
    const focusRules = SOURCE.match(/focus-visible:outline-adm-accent/g) ?? [];
    expect(focusRules.length).toBeGreaterThanOrEqual(interactive.length);
  });

  it('the disclosure is a native details/summary, so it works without script', () => {
    expect(SOURCE).toContain('<details');
    expect(SOURCE).toContain('<summary');
    /* No onClick-driven show/hide that a keyboard user could not reach. */
    expect(SOURCE).not.toMatch(/setShowAdvanced|toggleAdvanced/);
  });

  it('the reason field is labelled, and the label points at it', () => {
    expect(SOURCE).toContain('htmlFor={`reason-${row.name}`}');
    expect(SOURCE).toContain('id={`reason-${row.name}`}');
  });
});

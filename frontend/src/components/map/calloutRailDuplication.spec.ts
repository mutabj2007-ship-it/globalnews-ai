import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  SelectionCallout,
  CALLOUT_MAX_HEIGHT,
  CALLOUT_WIDTH,
} from '@/components/map/shell/SelectionCallout';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

/**
 * ══ R2-B §5 — THE MAP POPUP IS NOT A SECOND ACTION SURFACE ════════════════
 *
 * MAP-CALLOUT-RAIL-DUPLICATION · CTO/Product ruling, 2026-09-19
 *
 * "Add regression proving the full rail action set is not duplicated into the
 * desktop popup when both surfaces represent the same geography."
 *
 * THE MEASUREMENT THAT PROMPTED THE RULING: eight of eight callout blocks
 * duplicated a right-rail block, and the component was handed
 * `labels={spatial.card}` — the rail card's own dictionary. It was not a
 * summary of the rail; it was the rail's vocabulary redrawn over the map.
 *
 * ── HOW THIS FILE PROVES IT, AND WHY IT IS NOT A SPY ──────────────────────
 *
 * §1 renders the anchor and asserts the removed blocks are absent from the
 * markup. §2 proves something stronger from the TYPE and the CALL SITE: the
 * component no longer accepts the data or the handlers those blocks needed, so
 * there is no render — not merely no tested render — in which they can appear.
 *
 *     A spy proves one render drew no Follow button.
 *     A component with no `follow` prop proves none can.
 *
 * That is the R2-A provider-boundary principle applied to a surface instead of
 * a fetch, and it is why the blocks were deleted rather than branched behind a
 * flag.
 *
 * ── THE RULING'S CONDITION IS ALWAYS TRUE HERE, AND §3 PROVES IT ──────────
 *
 * The compact rule applies "when right rail = same selected geography". §3
 * shows that is the anchor's render condition rather than a case it happens to
 * be in: `calloutVisible` requires `hud.rightRail`, and the rail renders the
 * card for whatever `selection` holds.
 */

const SRC = resolve(__dirname, '..', '..');

const read = (...parts: string[]): string => readFileSync(join(SRC, ...parts), 'utf-8');

/** Comments stripped — these are assertions about code, not about prose. */
const code = (...parts: string[]): string =>
  read(...parts)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CALLOUT = code('components', 'map', 'shell', 'SelectionCallout.tsx');
const SHELL = code('components', 'map', 'shell', 'GlobalMapShell.tsx');
const RAIL_CARD = code('components', 'map', 'shell', 'EvidenceSelectionCard.tsx');

const LOCALES = [
  ['en', en],
  ['pl', pl],
] as const;

const anchor = (dict: typeof en): string =>
  renderToStaticMarkup(
    createElement(SelectionCallout, {
      geographyId: 'KEN',
      displayName: 'Kenia',
      identity: { iso3: 'KEN', region: 'Africa' },
      continents: dict.map.spatial.card.continents,
      placement: { x: 100, y: 120, side: 'right', parked: false },
      calloutLabels: dict.map.spatial.callout,
      onDismiss: () => undefined,
    }),
  );

/* ══════════════════════════════════════════════════════════════════════════
   1 — WHAT THE ANCHOR RENDERS, AND WHAT IT NO LONGER DOES
   ══════════════════════════════════════════════════════════════════════════ */

describe('the popup is a compact selection anchor', () => {
  for (const [locale, dict] of LOCALES) {
    it(`${locale} — it keeps the localized geography name`, () => {
      const html = anchor(dict);

      expect(html).toContain('data-gn-variant="compact-anchor"');
      expect(html).toContain('data-gn="callout-title"');
      expect(html).toContain('Kenia');
    });

    it(`${locale} — it keeps minimal type/context, localised`, () => {
      /*
        The ruling's keep-list permits "minimal type/context if useful". This
        is one line: the ISO-3 and the continent. `KEN · AFRICA` in a Polish
        rail is the §6 defect; here it reads `KEN · Afryka`.
      */
      const html = anchor(dict);

      expect(html).toContain('data-gn="callout-identity"');
      expect(html).toContain(dict.map.spatial.card.continents.Africa);
    });

    it(`${locale} — it keeps the close affordance, and it is a NAMED control`, () => {
      const html = anchor(dict);

      expect(html).toContain('data-gn="callout-close"');
      expect(html).toContain(`aria-label="${dict.map.spatial.callout.close}"`);
    });

    it(`${locale} — and it renders nothing else the rail already carries`, () => {
      /*
        The ruling's remove-list, one marker each, asserted on the rendered
        markup. §2 then proves the stronger structural form.
      */
      const html = anchor(dict);

      for (const removed of [
        'callout-provider',
        'callout-precision',
        'callout-stats',
        'callout-coverage',
        'callout-follow-signin',
        'callout-actions',
        'callout-action',
      ]) {
        expect({ removed, present: html.includes(removed) }).toEqual({
          removed,
          present: false,
        });
      }
    });

    it(`${locale} — exactly ONE control is rendered, and it is the close button`, () => {
      /*
        The sharpest form of "not a second action surface": count the controls.
        A future block that quietly reintroduces a button fails here even if
        nobody thinks to add a marker for it to the list above.
      */
      const html = anchor(dict);

      expect(html.split('<button').length - 1).toBe(1);
      expect(html.split('<a ').length - 1).toBe(0);
      expect(html).toContain('data-gn="callout-close"');
    });

    it(`${locale} — and no explanatory body copy`, () => {
      /*
        Named separately in the remove-list. The anchor carries a name, a code
        and a continent — no sentence. Measured as text length, because prose
        is what this rules out and prose is long.
      */
      const text = anchor(dict).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      expect(text.length).toBeLessThan(40);
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — THE STRUCTURAL PROOF: IT CANNOT RENDER WHAT IT CANNOT RECEIVE
   ══════════════════════════════════════════════════════════════════════════ */

describe('the full rail action set is not reachable from the popup', () => {
  it('the component accepts none of the rail data those blocks needed', () => {
    for (const prop of [
      'total',
      'provenance',
      'availableGeometry',
      'providerStatus',
      'coverage',
      'follow',
    ]) {
      expect({ prop, accepted: CALLOUT.includes(`readonly ${prop}`) }).toEqual({
        prop,
        accepted: false,
      });
    }
  });

  it('and none of the action handlers', () => {
    for (const handler of ['onFocus', 'onOpenAnalysis', 'onOpenSources', 'onToggle']) {
      expect({ handler, accepted: CALLOUT.includes(handler) }).toEqual({
        handler,
        accepted: false,
      });
    }
  });

  it('it no longer imports the rail’s follow control or its sign-in path', () => {
    expect(CALLOUT).not.toContain('FollowControl');
    expect(CALLOUT).not.toContain('accountSignInUrl');
    expect(CALLOUT).not.toContain('rememberMapStateForSignIn');
  });

  it('it no longer takes the rail card’s label block — the root cause', () => {
    /*
      `labels={spatial.card}` is how eight blocks of rail vocabulary got onto
      the map in the first place. The anchor takes ONE record: the five
      localised registry groupings its identity line needs.
    */
    expect(CALLOUT).not.toContain('EvidenceSelectionCardLabels');
    expect(CALLOUT).toContain('readonly continents');
  });

  it('THE CALL SITE passes none of it either', () => {
    /*
      Both halves, because a prop the component ignores is still a prop someone
      re-wires. The shell hands the anchor five things and no handler but
      dismissal.
    */
    const call = SHELL.slice(
      SHELL.indexOf('<SelectionCallout'),
      SHELL.indexOf('/>', SHELL.indexOf('<SelectionCallout')),
    );

    expect(call).toContain('continents={spatial.card.continents}');
    expect(call).toContain('onDismiss=');

    for (const removed of [
      'total=',
      'providerStatus=',
      'coverage=',
      'follow=',
      'onFocus=',
      'onOpenAnalysis=',
      'onOpenSources=',
      'labels={spatial.card}',
    ]) {
      expect({ removed, passed: call.includes(removed) }).toEqual({ removed, passed: false });
    }
  });

  it('the anchor shrank to match, so the first paint is not placed against a ghost', () => {
    /*
      `CALLOUT_MAX_HEIGHT` is the placement fallback before the real box is
      measured. Left at 320 for eight blocks it would have positioned the first
      frame against a height nearly four times what now renders.
    */
    expect(CALLOUT_MAX_HEIGHT).toBeLessThan(120);
    expect(CALLOUT_WIDTH).toBeLessThan(268);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — THE RAIL IS ALWAYS THE SAME GEOGRAPHY, WHICH IS WHY THE RULE IS TOTAL
   ══════════════════════════════════════════════════════════════════════════ */

describe('the ruling’s condition is the render condition', () => {
  it('the anchor cannot render without the right rail', () => {
    const gate = SHELL.slice(
      SHELL.indexOf('const calloutVisible ='),
      SHELL.indexOf('const calloutVisible =') + 400,
    );

    expect(gate).toContain('hud.rightRail');
    expect(gate).toContain('selection !== null');
  });

  it('and the rail renders the card for whatever the selection is', () => {
    /*
      So "right rail = same selected geography" is not a case the anchor might
      be in. It is the only case it can be in, which is what makes the compact
      form unconditional rather than a branch.
    */
    const rail = SHELL.slice(
      SHELL.indexOf('const rail = hud.rightRail ?'),
      SHELL.indexOf('const rail = hud.rightRail ?') + 260,
    );

    expect(rail).toContain('selection === null');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — DISMISSAL IS SELECTION-LOCAL, AND NOTHING IS PERSISTED
   ══════════════════════════════════════════════════════════════════════════ */

describe('dismissal is selection-local only', () => {
  it('it is keyed to the geography it was made for', () => {
    expect(SHELL).toContain('calloutDismissedFor !== selection.id');
    expect(SHELL).toContain('setCalloutDismissedFor(selection.id)');
  });

  it('NO persisted session or user preference, and no settings contract', () => {
    /*
      The ruling is explicit about this, and it is the one option I had
      considered before the ruling arrived — dismiss-once-stays-gone. It is
      ruled out, so it is asserted against rather than merely not written:
      selecting another geography must be able to show that one's anchor.
    */
    const dismissal = SHELL.slice(
      SHELL.indexOf('const [calloutDismissedFor'),
      SHELL.indexOf('const calloutVisible ='),
    );

    expect(dismissal).not.toContain('localStorage');
    expect(dismissal).not.toContain('sessionStorage');
    expect(dismissal).not.toContain('persist');
  });

  it('and the anchor itself owns no state at all', () => {
    /*
      The original amendment's rule — "the only local state it may own is
      whether the callout is dismissed" — held by keeping that boolean in the
      shell. Removing seven blocks must not have introduced any.
    */
    expect(CALLOUT).not.toContain('useState');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   5 — WHAT THE RULING REQUIRES TO SURVIVE
   ══════════════════════════════════════════════════════════════════════════ */

describe('the rail remains the authoritative detailed and action surface', () => {
  it('Follow, Open Analysis and Sources all still live in the rail card', () => {
    expect(RAIL_CARD).toContain('data-gn="card-follow"');
    expect(RAIL_CARD).toContain('data-gn="card-action"');
    expect(RAIL_CARD).toContain('FollowControl');
  });

  it('the shell still wires the rail’s analysis and sources handlers', () => {
    expect(SHELL).toContain('onOpenAnalysis');
    expect(SHELL).toContain('onOpenSources');
  });

  it('provider status and coverage still render in the rail', () => {
    expect(RAIL_CARD).toContain('data-gn="provider-status"');
    expect(RAIL_CARD).toContain('data-gn="coverage-band"');
  });

  it('map selection highlighting and semantic country state are untouched', () => {
    /*
      Named in the ruling's preserve-list. The anchor never owned either; this
      asserts the removal did not reach them.
    */
    expect(SHELL).toContain('selectedIso3');
    expect(SHELL).toContain('onSelectCountry');
  });

  it('COMPACT/MOBILE — there is only one action surface there, by construction', () => {
    /*
      "Do not render two simultaneous full action surfaces." The mobile shell
      renders no callout at all: the drawer is the only one, so the rule is met
      without a compact/mobile branch existing to get wrong. Asserted so a
      future mobile callout has to come past this line.
    */
    expect(code('components', 'map', 'mobile', 'MobileSpatialShell.tsx')).not.toContain(
      'SelectionCallout',
    );
  });
});

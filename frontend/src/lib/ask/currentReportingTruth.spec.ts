import { DISPLAY_LOCALES } from '@globalnews-ai/shared';
import { askR2View } from './askR2View';
import { askR2Strings } from './askR2Strings';
import { askShellStrings } from './shell/askShellCatalogue';
import { CARD_BRANCHES } from './testing/renderedLocale.testkit';
import { ASK_SAVABLE_ANSWER_STATES } from '@/components/ask-frame/AskTurnSave';
import type { AskR2Payload } from '@/lib/api/askV2Api';

/**
 * CURRENT-REPORTING TRUTH R1 (B1) — the one presentation mapping for the new canonical state.
 * RETAINED_REPORTING is an AI answer from retained reporting: never the current badge, always
 * "Retained reporting to …", no hand-offs, still a produced (savable) answer. Provider health is
 * a separate disclosure (B2): a live answer that lost a lane stays current with its notice.
 */
const stored = CARD_BRANCHES.storedReporting().payload;
const retained = {
  ...stored,
  answer: { state: 'RETAINED_REPORTING', basis: 'RETAINED_REPORTING_ONLY', missingRoles: [] },
} as unknown as AskR2Payload;

describe('RETAINED_REPORTING presentation', () => {
  const s = askR2Strings('en');
  const view = askR2View(retained, s, 'en');

  it('is its own non-current badge in the qualified tone, with no hand-offs', () => {
    expect(view.badge).toBe('retrep');
    expect(view.badgeText).toBe('RETAINED REPORTING');
    expect(view.tone).toBe('partial');
    expect(view.handoffs.openFull).toBe(false);
    expect(view.handoffs.runDeeper).toBe(false);
  });

  it('always states how far the retained reporting reaches', () => {
    expect(view.freshness).toMatch(/^Retained reporting to /);
  });

  it('is a produced answer, so it can be saved', () => {
    expect(ASK_SAVABLE_ANSWER_STATES.has('RETAINED_REPORTING')).toBe(true);
  });

  it('has its own badge copy in all seven languages (never the current copy, never English)', () => {
    for (const locale of DISPLAY_LOCALES) {
      const badges = askShellStrings(locale).askR2Strings.badges;
      expect(badges.retrep.length).toBeGreaterThan(3);
      expect(badges.retrep).not.toBe(badges.cur);
      if (locale !== 'en') expect(badges.retrep).not.toBe('RETAINED REPORTING');
    }
  });

  it('a live answer that lost a provider lane stays CURRENT and is disclosed as limited (B2)', () => {
    const partialLive = {
      ...stored,
      answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
      analysis: {
        ...stored.analysis!,
        retrievalContext: {
          ...stored.analysis!.retrievalContext,
          dataMode: 'live',
          outcome: undefined,
          fallbackReason: 'provider-error',
        },
      },
    } as unknown as AskR2Payload;
    const live = askR2View(partialLive, s, 'en');
    expect(live.badge).toBe('cur');
    expect(live.searchLimited).toBe(true);
  });
});

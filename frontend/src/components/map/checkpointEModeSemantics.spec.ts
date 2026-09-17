import { readFileSync } from 'fs';
import { join } from 'path';

import {
  LIVE_MAP_MODES,
  MAP_MODES,
  modeAvailability,
  modeUnavailableReason,
  type MapMode,
  type ModeUnavailableReason,
} from '@/lib/map/state/mapState';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT E-1 — THE BETA TABS SAY WHY, NOT JUST THAT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Top Beta tabs must not remain silent no-ops. Either implement
 * their intended approved behaviour, or present a truthful unavailable /
 * not-connected state."* And: *"Placeholder semantics must distinguish NOT BUILT
 * / NOT CONNECTED / NO DATA FOR THIS GEOGRAPHY / TIER RESTRICTED / TEMPORARILY
 * UNAVAILABLE. Do not collapse every condition into 'No data yet.'"*
 *
 * ─── WHAT WAS ALREADY TRUE, AND WHAT WAS NOT ──────────────────────────────
 *
 * The tabs were NOT silent no-ops: `ModeSwitcher` already disabled them,
 * carried a `title` and an `aria-label`, and returned early on click. That part
 * was sound and is unchanged.
 *
 * What was wrong is that FOUR MODES SHARED ONE WORD — "Unavailable" — for four
 * different situations. That told a reader a capability was absent while saying
 * nothing about whether it was coming, broken, empty here, or gated.
 *
 * ─── THE REASONS ARE EVIDENCE-BASED, NOT ASSIGNED BY TASTE ────────────────
 *
 * SITUATIONS is NOT_BUILT because the product already says so in its own words
 * (`situationsUnavailable`). Watch, Change and Sources are NOT_CONNECTED
 * because `Watchboard`, `WatchComposer`, `ChangeStrip` and `SourceCard` all
 * render elsewhere on the same screen — calling those "not built" would be
 * FALSER than the generic word it replaces.
 */

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const switcher = stripComments(
  readFileSync(join(__dirname, 'shell', 'ModeSwitcher.tsx'), 'utf-8'),
);
const en = readFileSync(join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries', 'en.ts'), 'utf-8');
const pl = readFileSync(join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries', 'pl.ts'), 'utf-8');

const BETA_MODES: readonly MapMode[] = ['SITUATIONS', 'WATCH', 'CHANGE', 'SOURCES'];

describe('E-1 — mode availability carries a reason', () => {
  describe('THE LIVE MODES ARE UNCHANGED', () => {
    it('WORLD and EVIDENCE remain the live modes', () => {
      expect([...LIVE_MAP_MODES]).toEqual(['WORLD', 'EVIDENCE']);
    });

    it('a live mode has NO unavailable reason', () => {
      for (const mode of LIVE_MAP_MODES) {
        expect(modeAvailability(mode)).toBe('live');
        expect(modeUnavailableReason(mode)).toBeNull();
      }
    });

    it('no mode was added or removed', () => {
      expect([...MAP_MODES]).toEqual([
        'WORLD',
        'EVIDENCE',
        'SITUATIONS',
        'WATCH',
        'CHANGE',
        'SOURCES',
      ]);
    });
  });

  describe('EVERY UNBUILT MODE STATES A SPECIFIC REASON', () => {
    it('no beta mode is left without one', () => {
      for (const mode of BETA_MODES) {
        expect(modeUnavailableReason(mode)).not.toBeNull();
      }
    });

    it('SITUATIONS is NOT_BUILT — the situation model does not exist', () => {
      expect(modeUnavailableReason('SITUATIONS')).toBe('NOT_BUILT');
    });

    it('Watch, Change and Sources are NOT_CONNECTED, because they DO exist elsewhere', () => {
      /*
        The distinction is the whole point. Calling these "not built" would tell
        a reader a capability they can see on the same screen does not exist.
      */
      expect(modeUnavailableReason('WATCH')).toBe('NOT_CONNECTED');
      expect(modeUnavailableReason('CHANGE')).toBe('NOT_CONNECTED');
      expect(modeUnavailableReason('SOURCES')).toBe('NOT_CONNECTED');
    });

    it('those capabilities really are present, which is what makes NOT_CONNECTED true', () => {
      const shellDir = join(__dirname, 'shell');
      const monetization = join(shellDir, 'monetization');

      for (const file of ['Watchboard.tsx', 'WatchComposer.tsx', 'ChangeStrip.tsx']) {
        expect(() => readFileSync(join(monetization, file), 'utf-8')).not.toThrow();
      }

      expect(() => readFileSync(join(shellDir, 'SourceCard.tsx'), 'utf-8')).not.toThrow();
    });

    it('the reasons are not all the same word — the flattening is gone', () => {
      const reasons = new Set(BETA_MODES.map((mode) => modeUnavailableReason(mode)));

      expect(reasons.size).toBeGreaterThan(1);
    });
  });

  describe('AN UNDECLARED MODE DOES NOT GET AN INVENTED EXPLANATION', () => {
    it('falls back to TEMPORARILY_UNAVAILABLE, the only reason that promises nothing', () => {
      /*
        A mode added without deciding what it is would otherwise be silently
        described as NOT_BUILT — an explanation nobody wrote.
      */
      const unknown = 'FUTURE_MODE' as MapMode;

      expect(modeUnavailableReason(unknown)).toBe('TEMPORARILY_UNAVAILABLE');
    });
  });

  describe('THE SWITCHER RENDERS THE SPECIFIC REASON', () => {
    it('asks for the reason rather than using the generic label', () => {
      expect(switcher).toContain('const reason = modeUnavailableReason(mode);');
      expect(switcher).toContain(
        "reason === null ? labels.unavailable : labels.unavailableReasons[reason]",
      );
    });

    it('a pinned surface keeps its OWN explanation, which is about the surface', () => {
      expect(switcher).toContain(
        'const disabledReason = pinned && !isActive ? pinnedReason : unavailableText;',
      );
    });

    it('the reason reaches both the tooltip and the accessible name', () => {
      expect(switcher).toContain('title={disabled ? disabledReason : undefined}');
      expect(switcher).toContain(
        'aria-label={disabled ? `${labels.modes[mode]} — ${disabledReason}` : undefined}',
      );
    });

    it('the reason is exposed as data for tests and tooling', () => {
      expect(switcher).toContain(
        "data-gn-unavailable-reason={disabled && reason !== null ? reason : undefined}",
      );
    });

    it('a disabled mode still does not act on click', () => {
      expect(switcher).toContain('if (disabled) return;');
    });

    it('the beta marker is still rendered', () => {
      expect(switcher).toContain('β');
    });
  });

  describe('ALL FIVE REASONS ARE TRANSLATED, IN BOTH LANGUAGES', () => {
    const REASONS: readonly ModeUnavailableReason[] = [
      'NOT_BUILT',
      'NOT_CONNECTED',
      'NO_DATA_FOR_GEOGRAPHY',
      'TIER_RESTRICTED',
      'TEMPORARILY_UNAVAILABLE',
    ];

    it('en declares every reason', () => {
      for (const reason of REASONS) expect(en).toContain(`${reason}:`);
    });

    it('pl declares every reason', () => {
      for (const reason of REASONS) expect(pl).toContain(`${reason}:`);
    });

    it('none of them is the collapsed "No data yet"', () => {
      expect(en).not.toMatch(/unavailableReasons:[\s\S]{0,400}No data yet/);
    });

    it('TIER_RESTRICTED exists but names no price — monetization is still under review', () => {
      expect(en).toContain("TIER_RESTRICTED: 'Not included in your access'");
      expect(en).not.toMatch(/TIER_RESTRICTED:\s*'[^']*(\$|€|£|upgrade now|buy|subscribe)/i);
    });
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * STANDALONE PUBLIC BETA CONVERGENCE R1 — a Sources-empty explanation appears ONCE per
 * visible layout. At >=1280, where the Sources column is shown for the latest answer, the
 * column states it and the card's inline line steps aside; below 1280 there is no column and
 * the card keeps it. Same rule for the clarification note and for "No citable sources".
 */
const css = readFileSync(join(__dirname, 'askDashboard.module.css'), 'utf8');
const turn = readFileSync(join(__dirname, 'AskR2TurnView.tsx'), 'utf8');
const column = readFileSync(join(__dirname, 'AskSourcesColumn.tsx'), 'utf8');
const wide = css.slice(css.indexOf('@media (min-width: 1280px)'));
const wideBlock = wide.slice(0, wide.indexOf('\n}\n') + 3);

describe('Sources-empty explanations: once per visible layout', () => {
  it.each(['sources-after-choice', 'no-citable'])(
    '%s: the card line is hidden only when the Sources column is visible (>=1280)',
    (marker) => {
      expect(turn).toContain(`data-ask="${marker}"`);
      expect(wideBlock).toMatch(
        new RegExp(
          String.raw`\.frame\[data-ask-sources-column='true'\]\s+\[data-ask-latest\]\s+:global\(\[data-ask='${marker}'\]\)\s*\{\s*display: none;`,
        ),
      );
    },
  );

  it('the column states "No citable sources" / "Sources appear after you choose" itself', () => {
    expect(column).toMatch(/s\.sourcesAfterChoice\s*:\s*s\.noCitable/);
  });

  it('the Reference Background provenance note stays in the card', () => {
    expect(turn).toContain('data-ask="reference-note"');
    expect(css).not.toMatch(/reference-note'\]\)\s*\{\s*display: none/);
  });
});

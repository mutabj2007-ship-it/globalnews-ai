import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ASK R2 D25 COMPOSER CLIPPING FIX R1 — the composer group (input, Ask, disclosure line,
 * bottom padding) can never sit below the viewport on desktop, because the frame's height
 * is structural: /ask is one viewport-high column (shared header + frame, frame takes the
 * rest). No one-time measurement of the frame's own top may size it again — that is what
 * let a late layout change push "Research runs only when you submit a question." off-screen.
 */
const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
const css = read('components/ask-frame/askDashboard.module.css');
const page = read('app/ask/page.tsx');
const themedPage = read('components/ask-nav/AskThemedPage.tsx');
const frame = read('components/ask-frame/AskFrameScreen.tsx');
const rule = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

describe('D25 /ask — the composer stays inside the visible frame', () => {
  it('the route is one viewport-high column that never scrolls as a page', () => {
    /* TRUST R1 — the column element is rendered by AskThemedPage (also the theme scope). */
    expect(page).toContain('<AskThemedPage theme={theme}>');
    expect(themedPage).toContain('className={styles.page}');
    expect(rule('.page')).toMatch(/height: 100dvh;/);
    expect(rule('.page')).toMatch(/overflow: hidden;/);
    expect(rule('.page')).toMatch(/flex-direction: column;/);
    expect(css).toMatch(/\.page > :global\(header\) \{\s*flex-shrink: 0;/);
  });

  it('the frame takes exactly the remaining height — no measured top, no min-height floor', () => {
    const f = rule('.frame');
    expect(f).toMatch(/flex: 1 1 0;/);
    expect(f).toMatch(/min-height: 0;/);
    expect(f).not.toMatch(/--ask-top|height: calc/);
    expect(css).not.toContain('--ask-top');
    expect(frame).not.toContain('--ask-top');
  });

  it('the composer bar never shrinks and the conversation stays the only scroll area', () => {
    expect(rule('.composerBar')).toMatch(/flex-shrink: 0;/);
    expect(rule('.reader')).toMatch(/overflow-y: auto;/);
    expect(rule('.reader')).toMatch(/min-height: 0;/);
    /* The disclosure line lives inside the composer group, below the input row. */
    expect(read('components/ask-frame/AskParts.tsx')).toMatch(
      /data-ask="send"[\s\S]*data-ask="cost-note"/,
    );
  });

  it('phone / 768 keep the keyboard-aware full-screen height', () => {
    expect(frame).toContain("'--ask-visible-height'");
    /* ASK RELIABILITY R1 (Q) — the frame follows the VISIBLE box (top AND height) so Safari's keyboard
       pan can hide neither the header/close nor the composer; no bottom, nothing over-constrained. */
    expect(css).toMatch(
      /position: fixed;[\s\S]{0,260}top: var\(--ask-visible-top, 0px\);[\s\S]{0,80}bottom: auto;[\s\S]{0,60}height: var\(--ask-visible-height, 100dvh\);/,
    );
    expect(frame).toContain("'--ask-visible-top'");
  });
});

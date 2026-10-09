'use client';

import { useRef, useState } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import styles from './askDashboard.module.css';
import { AskActionGlyph } from './AskActionGlyph';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — Copy one answer to the clipboard.
 *
 * Copies only what this turn shows the reader: their own question and the visible answer text
 * (and the visible source titles/links, which are already public reporting). Nothing is sent
 * anywhere, nothing is shared publicly, and no private context (saved stories, account) is
 * added. Zero network, zero AI.
 */
/*
  R4 · PHASE B — this file used to declare its own `Record<AskR2Locale, …>` of three strings.
  A module-private catalogue is unreachable by every localization mechanism the product has:
  no overlay can replace it, no coverage report can count it, and no missing-key test can
  fail on it, so a French reader would have been shown "Copy" and "Copied" in English however
  complete the catalogues became. The three strings now live in `askSurfaceStrings.ts` and are
  resolved by the one shell resolver, verbatim.
*/

export function AskTurnCopy({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const t = askShellStrings(locale).askCopyStrings;
  const button = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy(): Promise<void> {
    const turn = button.current?.closest('[data-ask-turn]');
    if (!turn) return;
    const question = turn.querySelector('h2')?.textContent?.trim() ?? '';
    const answer = [
      ...turn.querySelectorAll<HTMLElement>('[data-ask="answer"], [data-ask="computation"]'),
    ]
      .map((node) => node.innerText.trim())
      .filter((text) => text.length > 0)
      .join('\n\n');
    const sources = [
      ...turn.querySelectorAll<HTMLAnchorElement>('[data-ask="sources"] a[href^="http"]'),
    ]
      .map((a) => `- ${a.textContent?.trim() ?? ''} ${a.href}`)
      .join('\n');
    const text = [question, answer, sources].filter((part) => part.length > 0).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2000);
  }

  /*
    CLAUDE DESIGN R3 §10 — the approved icon control. The visible text label is gone; its three
    states are not. `aria-label` and `title` carry the SAME qualified strings the label carried,
    so no reader loses the word and no new string was invented, and the state still reaches a
    screen reader through the polite live region below, which is visually hidden rather than
    removed. Geometry, colour and interaction states are the stylesheet's
    (`[data-ask='turn-actions'] button`), exactly as the package specifies them.
  */
  const label = state === 'copied' ? t.copied : state === 'failed' ? t.failed : t.copy;
  return (
    <button
      ref={button}
      type="button"
      data-ask="copy"
      data-ask-copy-state={state}
      aria-label={label}
      title={label}
      onClick={() => void copy()}
    >
      <AskActionGlyph name="copy" />
      <span aria-live="polite" className={styles.visuallyHidden}>
        {state === 'copied' ? t.copied : state === 'failed' ? t.failed : ''}
      </span>
    </button>
  );
}

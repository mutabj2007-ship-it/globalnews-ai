'use client';

import { useRef, useState } from 'react';
import type { AskR2Locale } from '@/lib/ask/askR2Strings';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — Copy one answer to the clipboard.
 *
 * Copies only what this turn shows the reader: their own question and the visible answer text
 * (and the visible source titles/links, which are already public reporting). Nothing is sent
 * anywhere, nothing is shared publicly, and no private context (saved stories, account) is
 * added. Zero network, zero AI.
 */
const STRINGS: Record<AskR2Locale, { copy: string; copied: string; failed: string }> = {
  en: { copy: 'Copy', copied: 'Copied', failed: 'Copy failed' },
  pl: { copy: 'Kopiuj', copied: 'Skopiowano', failed: 'Nie udało się skopiować' },
};

export function AskTurnCopy({ locale }: { readonly locale: AskR2Locale }): JSX.Element {
  const t = STRINGS[locale];
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

  return (
    <button
      ref={button}
      type="button"
      data-ask="copy"
      onClick={() => void copy()}
      className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[#1d4a73] px-3 font-cd-body text-[13px] font-semibold text-[#cfe2f2] hover:bg-[#07304f] md:min-h-[32px]"
    >
      <span aria-live="polite">
        {state === 'copied' ? t.copied : state === 'failed' ? t.failed : t.copy}
      </span>
    </button>
  );
}

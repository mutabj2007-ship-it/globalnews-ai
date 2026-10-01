'use client';

import { useState, type JSX } from 'react';
import {
  COMPARE_MAX_STORIES,
  COMPARE_MIN_STORIES,
  askCompareHref,
} from '@/lib/ask/askSelectionRef';

/**
 * UNIFIED INTELLIGENCE BINDING R2H — "Compare stories" on Home.
 *
 * A collapsed disclosure beneath the story rail. The cards themselves are untouched. Choosing
 * stories is LOCAL STATE ONLY (no request, no browser storage); the action is a plain link that
 * opens the ONE Ask (/ask) with the chosen stories staged as a COMPARE selection. Nothing runs
 * until the reader presses Ask there — that one press is one Ask V2 operation, under the same
 * quota / guest rules as every other Ask question.
 *
 * Titles are DISPLAY ONLY here; only the stories' URLs travel, and /ask derives the references.
 */
const STRINGS = {
  en: {
    summary: 'Compare stories',
    hint: `Pick ${COMPARE_MIN_STORIES}–${COMPARE_MAX_STORIES} stories. Nothing runs until you press Ask.`,
    action: (n: number) => `Compare in Ask (${n})`,
    needMore: `Choose at least ${COMPARE_MIN_STORIES} stories`,
  },
  pl: {
    summary: 'Porównaj artykuły',
    hint: `Wybierz ${COMPARE_MIN_STORIES}–${COMPARE_MAX_STORIES} artykułów. Nic nie zostanie uruchomione, dopóki nie naciśniesz Zapytaj.`,
    action: (n: number) => `Porównaj w Zapytaj (${n})`,
    needMore: `Wybierz co najmniej ${COMPARE_MIN_STORIES} artykuły`,
  },
} as const;

export function HomeCompare({
  stories,
  language,
}: {
  readonly stories: readonly { readonly title: string; readonly url: string }[];
  readonly language: string;
}): JSX.Element | null {
  const t = STRINGS[language === 'pl' ? 'pl' : 'en'];
  const [chosen, setChosen] = useState<readonly string[]>([]);
  if (stories.length < COMPARE_MIN_STORIES) return null;

  const toggle = (url: string) =>
    setChosen((current) =>
      current.includes(url)
        ? current.filter((u) => u !== url)
        : current.length >= COMPARE_MAX_STORIES
          ? current
          : [...current, url],
    );
  const href = askCompareHref(chosen, '/');

  return (
    <details
      data-home-compare
      className="rounded-2xl border border-[#17324f] bg-[#0b1c31]/70 px-4 py-2 text-[13px] text-[#a8c0da]"
    >
      <summary className="flex min-h-[44px] cursor-pointer items-center font-medium text-white">
        {t.summary}
      </summary>
      <p className="pb-2 text-[12px] text-[#8299b4]">{t.hint}</p>
      <ul className="flex flex-col gap-1">
        {stories.map((story) => {
          const checked = chosen.includes(story.url);
          const full = !checked && chosen.length >= COMPARE_MAX_STORIES;
          return (
            <li key={story.url}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={full}
                  onChange={() => toggle(story.url)}
                  className="h-4 w-4 shrink-0 accent-cyan-300"
                />
                <span className="line-clamp-2">{story.title}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex min-h-[44px] items-center pt-2">
        {href === undefined ? (
          <span aria-disabled="true" className="text-[#8299b4]">
            {t.needMore}
          </span>
        ) : (
          <a
            href={href}
            data-home-compare-action
            className="inline-flex min-h-[44px] items-center rounded-full border border-cyan-300/55 px-4 font-medium text-white hover:bg-[#12293f]"
          >
            {t.action(chosen.length)} →
          </a>
        )}
      </div>
    </details>
  );
}

'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { ArrowLeft, ExternalLink, Layers, MessagesSquare, X } from 'lucide-react';
import { safeExternalHref, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { clearHeldStories, releaseHeldStory, useHeldStories, type HeldStory } from '@/lib/home/heldStoriesStore';
import { resolveStoriesForCompare, type CompareStoryView } from '@/lib/api/compareApi';
import { relationSentences, type CompareIdentity, type RelationCopy } from '@/lib/home/compareRelation';
import { askCompareHref } from '@/lib/ask/askSelectionRef';
import { fill } from '@/components/home/reva/homeRevaModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME R1 · STAGE A — THE SELECTED-STORIES TRAY AND THE BASIC COMPARE VIEW
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ZERO AI, BY CONSTRUCTION. Holding, releasing, clearing, opening the tray and opening
 * Compare call no model and no analysis path. The tray is pure local state. Compare makes
 * ONE read — POST /news/stories/resolve, retained reporting by governed identity — and
 * shows what is held: place, reporting date, subject, publisher and sources. Where nothing
 * is held it says "Not available" (key claims and known gaps need a held brief, which does not
 * exist; nothing is fabricated in their place). STAGE B: the same / separate row states only
 * what stored canonical story identity PROVES (lib/home/compareRelation.ts) — one story, or
 * separated by an editor — and otherwise says the link is not established.
 *
 * The phone tray sits ABOVE the bottom navigation (never over it) and a spacer keeps the
 * page's last content reachable beneath it.
 *
 * Leaving Compare for Ask (CONVERGENCE — Unified Intelligence Binding R2 is canonical): "Ask
 * GlobalNewsAI about these stories" is R2H's own launcher (askCompareHref): it opens the ONE
 * Ask (/ask) with the held stories staged as a canonical SELECTION (action COMPARE) — URLs only,
 * nothing runs on arrival. The reader's Send there is ONE Ask V2 turn; deeper work is quoted
 * there by R2's runDeeper and runs only after Accept. No second context protocol exists here.
 */
export function HomeR1Compare({
  language,
  compareView,
}: {
  readonly language: LanguageCode;
  readonly compareView: boolean;
}): JSX.Element | null {
  const t = getDictionary(language).homeR1;
  const held = useHeldStories();
  const [open, setOpen] = useState(false);
  if (held.length === 0 && !open) return null;
  return (
    <>
      {held.length > 0 && (
        <>
          {/* Keeps the page's last content reachable above the fixed tray. */}
          <div aria-hidden="true" data-home-r1-tray-spacer="" className="h-[150px] lg:h-[110px]" />
          <section
            aria-label={t.tray.ariaLabel}
            data-home-r1-tray=""
            className="fixed inset-x-2 bottom-[calc(62px+env(safe-area-inset-bottom))] z-40 rounded-[14px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-3 shadow-[0_18px_40px_-18px_rgba(20,36,59,0.55)] lg:inset-x-auto lg:bottom-4 lg:right-4 lg:w-[440px]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[14px] font-bold text-[var(--gt-ink)]">
                <Layers aria-hidden="true" className="h-4 w-4 text-[var(--gt-link)]" />
                {held.length === 1 ? t.tray.oneSelected : fill(t.tray.nSelected, { n: held.length })}
                <span className="text-[12px] font-normal text-[var(--gt-ink2)]">{t.tray.upTo}</span>
              </p>
              <button type="button" data-home-r1-tray-clear="" onClick={() => clearHeldStories()} className="min-h-[44px] px-2 text-[13px] font-semibold text-[var(--gt-link)]">
                {t.tray.clear}
              </button>
            </div>
            {held.length === 1 && <p className="text-[12.5px] text-[var(--gt-ink2)]">{t.tray.selectOneMore}</p>}
            {compareView && (
              <button
                type="button"
                data-home-r1-compare-open=""
                disabled={held.length < 2}
                onClick={() => setOpen(true)}
                className="mt-2 inline-flex min-h-[44px] items-center rounded-full bg-[var(--gt-act)] px-5 text-[14px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.tray.compareSelected}
              </button>
            )}
            <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {held.map((story) => (
                <li key={story.articleRef} className="flex max-w-[200px] shrink-0 items-center gap-2 rounded-[8px] border border-[var(--gt-line)] bg-[var(--gt-sunk)] py-1 pl-2 pr-1">
                  <span className="truncate text-[12.5px] font-semibold text-[var(--gt-ink)]">{story.card.title}</span>
                  <button
                    type="button"
                    aria-label={`${t.tray.remove}: ${story.card.title}`}
                    onClick={() => releaseHeldStory(story.articleRef)}
                    className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-[var(--gt-ink2)] hover:text-[var(--gt-ink)]"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {open && (
        <CompareWorkspace
          stories={held}
          language={language}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

type ReadState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; byRef: ReadonlyMap<string, CompareStoryView>; identity?: CompareIdentity };

/** Stage B — the same / separate row: only what stored story identity proves. */
function RelationCell({
  colSpan,
  refs,
  identity,
  copy,
}: {
  readonly colSpan: number;
  readonly refs: readonly string[];
  readonly identity: CompareIdentity | undefined;
  readonly copy: RelationCopy;
}): JSX.Element {
  const relation = relationSentences(refs, identity, copy);
  return (
    <td colSpan={colSpan} data-compare-relation={relation.kind} className={`p-3 ${relation.kind === 'proven' ? 'text-[var(--gt-ink)]' : 'text-[var(--gt-ink3)]'}`}>
      {relation.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </td>
  );
}

function CompareWorkspace({
  stories,
  language,
  onClose,
}: {
  readonly stories: readonly HeldStory[];
  readonly language: LanguageCode;
  readonly onClose: () => void;
}): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.homeR1.compare;
  const categories = dict.map.categories;
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [read, setRead] = useState<ReadState>({ kind: 'loading' });
  /* The identities the view was opened with: the ONE read is for exactly these. */
  const [opened] = useState(() => stories);

  useEffect(() => {
    let live = true;
    void resolveStoriesForCompare(opened).then((outcome) => {
      if (!live) return;
      setRead(
        outcome.ok
          ? { kind: 'ready', byRef: new Map(outcome.stories.map((s) => [s.articleRef, s])), identity: outcome.identity }
          : { kind: 'failed' },
      );
    });
    return () => {
      live = false;
    };
  }, [opened]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const viewOf = (story: HeldStory): CompareStoryView | undefined =>
    read.kind === 'ready' ? read.byRef.get(story.articleRef) : undefined;
  const cell = (story: HeldStory, render: (a: NonNullable<CompareStoryView['article']>) => string): string => {
    const view = viewOf(story);
    if (read.kind !== 'ready') return '';
    if (view?.article === undefined) return t.notAvailable;
    return render(view.article);
  };
  const rows: readonly { label: string; value: (s: HeldStory) => string }[] = [
    { label: t.rows.place, value: (s) => cell(s, (a) => a.countryName ?? t.notAvailable) },
    {
      label: t.rows.date,
      value: (s) =>
        cell(s, (a) => {
          const at = formatObservationalTime(a.publishedAt, a.publishedAtBasis as never, language);
          return at === '' ? t.notAvailable : at;
        }),
    },
    { label: t.rows.subject, value: (s) => cell(s, (a) => categories[a.category] ?? a.category) },
    {
      label: t.rows.publisher,
      value: (s) => cell(s, (a) => `${a.sourceName} · ${pluralWithForms(a.sourcesCount, language, t.sourceForms)}`),
    },
    { label: t.rows.claims, value: () => (read.kind === 'ready' ? t.noBrief : '') },
    { label: t.rows.gaps, value: () => (read.kind === 'ready' ? t.notAvailable : '') },
  ];

  /* R2H — the canonical SELECTION launcher; undefined (no link) outside 2..8 usable stories. */
  const askHref = askCompareHref(opened.map((story) => story.url), '/');

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="home-r1-compare-title" data-home-r1-compare="" className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--gt-bg)] lg:bg-[var(--gt-scrim)] lg:p-8">
      <div className="mx-auto min-h-full max-w-[980px] bg-[var(--gt-bg)] p-4 lg:min-h-0 lg:rounded-[16px] lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-r1-compare-title" className="flex items-center gap-2 font-display text-[22px] font-bold text-[var(--gt-ink)]">
            <button ref={closeRef} type="button" onClick={onClose} aria-label={t.close} className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-[var(--gt-ink2)] hover:bg-[var(--gt-card)]">
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            {fill(t.title, { n: pluralWithForms(opened.length, language, t.storyForms) })}
          </h2>
        </div>
        <p className="mt-2 inline-flex items-center gap-2 rounded-[8px] border border-[var(--gt-line)] bg-[var(--gt-card)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--gt-ink)]">
          {t.held}
        </p>

        <div className="mt-4 overflow-x-auto rounded-[12px] border border-[var(--gt-line)] bg-[var(--gt-card)]">
          <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--gt-sunk)]">
                <th scope="col" className="w-[150px] p-3" />
                {opened.map((story) => {
                  const article = viewOf(story)?.article;
                  return (
                    <th key={story.articleRef} scope="col" className="p-3 align-top">
                      <span className="line-clamp-3 text-[13.5px] font-bold leading-snug text-[var(--gt-ink)]">{article?.title ?? story.card.title}</span>
                      <a
                        href={safeExternalHref(story.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-publisher-link="compare"
                        className="mt-1 inline-flex min-h-[32px] items-center gap-1 text-[12px] font-semibold text-[var(--gt-link)] hover:underline"
                      >
                        {t.readSource}
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      </a>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {read.kind === 'loading' && (
                <tr>
                  <td colSpan={opened.length + 1} role="status" className="p-4 text-[var(--gt-ink2)]">
                    {t.loading}
                  </td>
                </tr>
              )}
              {read.kind === 'failed' && (
                <tr>
                  <td colSpan={opened.length + 1} role="alert" className="p-4 text-[var(--gt-amberInk)]">
                    {t.failed}
                  </td>
                </tr>
              )}
              {read.kind === 'ready' &&
                rows.map((row) => (
                  <tr key={row.label} className="border-t border-[var(--gt-line2)]">
                    <th scope="row" className="p-3 align-top text-[12px] font-semibold text-[var(--gt-ink2)]">
                      {row.label}
                    </th>
                    {opened.map((story) => {
                      const value = row.value(story);
                      return (
                        <td
                          key={story.articleRef}
                          data-compare-cell={value === t.notAvailable || value === t.noBrief ? 'not-available' : 'held'}
                          className={`p-3 align-top ${value === t.notAvailable || value === t.noBrief ? 'text-[var(--gt-ink3)]' : 'text-[var(--gt-ink)]'}`}
                        >
                          {viewOf(story)?.status === 'unavailable' && row.label === t.rows.place ? t.unresolved : value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              {read.kind === 'ready' && (
                <tr className="border-t border-[var(--gt-line2)]">
                  <th scope="row" className="p-3 align-top text-[12px] font-semibold text-[var(--gt-ink2)]">
                    {t.relationLabel}
                  </th>
                  <RelationCell colSpan={opened.length} refs={opened.map((s) => s.articleRef)} identity={read.identity} copy={t} />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {askHref !== undefined && (
          <section className="mt-4 flex flex-col gap-3 rounded-[12px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-[14px] font-bold text-[var(--gt-ink)]">
                <MessagesSquare aria-hidden="true" className="h-4 w-4 text-[var(--gt-link)]" />
                {t.askThese}
              </p>
              <p className="mt-1 text-[12.5px] text-[var(--gt-ink2)]">{t.askTheseSub}</p>
              <p className="mt-1 text-[12px] text-[var(--gt-ink3)]">{t.deeperNote}</p>
            </div>
            <a
              href={askHref}
              data-home-r1-ask-these=""
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-[var(--gt-act)] px-5 text-[14px] font-semibold text-[var(--gt-link)] hover:bg-[var(--gt-actSoft)]"
            >
              {t.askThese}
            </a>
          </section>
        )}
        <p className="mt-3 text-[12px] text-[var(--gt-ink2)]">{t.freeNote}</p>
      </div>
    </div>
  );
}

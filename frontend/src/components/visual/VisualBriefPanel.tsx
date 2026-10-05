'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { ArrowLeft, Bell, BellRing, ExternalLink, MessagesSquare, ShieldCheck, X } from 'lucide-react';
import { safeExternalHref, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { fill } from '@/components/home/reva/homeRevaModel';
import { useHomeSession } from '@/components/home/reva/HomeSession';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { readStoryBrief, requestStoryBrief, resolveStoryId, type CanonicalStoryIdentity } from '@/lib/api/storyBriefApi';
import type { BriefResult, BriefRunIntent, StoryBriefFailureKind, StoryBriefView, StoryId } from '@/lib/storyBrief/storyBriefView';
import {
  closeVisualBrief,
  closeVisualBriefFromHistory,
  setVisualEvidence,
  useVisualBrief,
  type VisualBriefStory,
  type VisualEvidenceItem,
} from '@/lib/visual/visualBriefStore';
import { openAlertSetup, openAlertsCentre, openDiscussion, useStageB, type StoryTarget } from '@/lib/stories/stageBStore';
import { publishStoryContext } from '@/lib/ask/storyContextStore';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';
import { VISUAL_HOME_HREF } from '@/lib/visual/visualNav';
import { adminStoryHref, useVisualAdminInspect } from '@/lib/visual/visualAdminInspect';
import { VisualBriefStateView, type VisualBriefActions } from './VisualBriefStateView';
import { BriefEditorialContext } from './home/BriefEditorialContext';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — THE STORY BRIEF PANEL (presentation over the canonical Brief)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * GEOMETRY (design doc 01): ≥1200 px a complementary panel BESIDE the stories (520 px, no scrim,
 * the feed reflows); 600–1199 a modal drawer over a scrim; <600 a full-height sheet with Back.
 * Escape steps back (evidence preview → brief → closed); scrim and Close close it; focus returns
 * to the opener; browser Back closes it (one pushed history entry).
 *
 * HIERARCHY: Brief → evidence → Discussion → follow / Ask.
 *
 * TRUTH (EA-STORY-BRIEF-01, CTO §5–§6):
 *   · Opening reads: articleRef → canonical story through GET /stories/by-article (read-only, no
 *     Discussion dependency) → GET the Brief (ZERO compute).
 *     Reopening is the same read. Nothing on open can generate.
 *   · Generation (POST) only from an explicit action — the card's Read brief press when no Brief
 *     exists, Refresh on a STALE Brief, or Try again on a retryable failure — and only when the
 *     server says `generationAvailable` AND the reader is signed in. Guests read existing Briefs
 *     and never generate (Beta policy). Discuss never generates.
 *   · Gate OFF (404) or no story record: the panel says which, and shows
 *     the reporting the page already holds — never a fabricated Brief.
 *
 * ADMIN LINKAGE: the panel carries the canonical ids it actually used (story id, articleRef,
 * evidence revision, Brief version) as data attributes, so Alpha Admin can inspect exactly the
 * backend record this surface rendered. Nothing private or operational is shown to the reader.
 */
type Load =
  | { readonly kind: 'reading' }
  | { readonly kind: 'unavailable'; readonly reason: Exclude<BriefResult<never>, { ok: true }>['reason'] }
  | { readonly kind: 'ready'; readonly view: StoryBriefView };

const WIDE_QUERY = '(min-width: 1200px)';
const ASK_FOLLOW_UP_OWNER = Symbol('visual-brief-ask-follow-up');
const RETRYABLE: ReadonlySet<StoryBriefFailureKind> = new Set(['PROVIDER_DEGRADED', 'EXECUTION_FAILED', 'OUTCOME_UNKNOWN']);

function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const sync = (): void => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return wide;
}

export function VisualBriefPanel({
  language,
  discussionRead,
  alertsInApp,
}: {
  readonly language: LanguageCode;
  readonly discussionRead: boolean;
  readonly alertsInApp: boolean;
}): JSX.Element | null {
  const panel = useVisualBrief();
  const stageB = useStageB();
  const { user, isLoading } = useHomeSession();
  const signedIn = !isLoading && user !== null;
  const wide = useWide();
  /* Alpha / Admin only: decided by the existing Admin identity read, signed-in readers only. */
  const adminInspect = useVisualAdminInspect(panel.kind === 'brief' && !isLoading && user !== null);
  const [load, setLoad] = useState<Load>({ kind: 'reading' });
  const [identity, setIdentity] = useState<CanonicalStoryIdentity | null>(null);
  const storyId: StoryId | null = identity?.storyId ?? null;
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const opener = useRef<Element | null>(null);
  const briefScroll = useRef(0);
  const autoRunFor = useRef<string | null>(null);
  const open = panel.kind === 'brief';
  const story = open ? panel.story : null;
  const ref = story?.articleRef ?? null;
  const section = open ? panel.section : 'top';
  const evidence = open ? panel.evidence : null;

  const apply = useCallback((result: BriefResult<StoryBriefView>): StoryBriefView | null => {
    if (result.ok) {
      setLoad({ kind: 'ready', view: result.value });
      return result.value;
    }
    setLoad({ kind: 'unavailable', reason: result.reason });
    return null;
  }, []);

  const run = useCallback(
    async (id: StoryId, intent: BriefRunIntent): Promise<void> => {
      setBusy(true);
      apply(await requestStoryBrief(id, intent));
      setBusy(false);
    },
    [apply],
  );

  /* ONE resolve + ONE zero-compute read per opened story. */
  useEffect(() => {
    if (ref === null) return undefined;
    let live = true;
    setLoad({ kind: 'reading' });
    setIdentity(null);
    void (async () => {
      /* Canonical resolution — independent of Discussion (PUBLIC-ENGINEERING-BASELINE-R1 §2). */
      const resolved = await resolveStoryId(ref);
      if (!live) return;
      if (!resolved.ok) {
        apply(resolved);
        return;
      }
      setIdentity(resolved.value);
      apply(await readStoryBrief(resolved.value.storyId));
    })();
    return () => {
      live = false;
    };
  }, [ref, apply]);

  /*
   * The card's Read brief press IS the explicit request (CTO §6). Once the read says NONE, a
   * signed-in reader with generation available gets ONE run — never from Discuss, never on reopen
   * of an existing Brief, never for a guest.
   */
  useEffect(() => {
    if (load.kind !== 'ready' || storyId === null || ref === null) return;
    if (section !== 'top' || !signedIn || load.view.state !== 'NONE' || !load.view.generationAvailable) return;
    if (autoRunFor.current === ref) return;
    autoRunFor.current = ref;
    void run(storyId, 'READ_BRIEF');
  }, [load, storyId, ref, section, signedIn, run]);

  useEffect(() => {
    if (!open) autoRunFor.current = null;
  }, [open]);

  /* Focus: into the panel on open, back to the opener on close. */
  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    headingRef.current?.focus();
    return () => {
      const el = opener.current;
      if (el instanceof HTMLElement && el.isConnected) el.focus();
    };
  }, [open]);

  /* Browser Back closes the brief. */
  useEffect(() => {
    if (!open) return undefined;
    const onPop = (): void => closeVisualBriefFromHistory();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);

  /* Escape steps back — unless a Stage B panel (Discussion / Alert) is open above the brief. */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || stageB.panel.kind !== 'none') return;
      if (evidence !== null) setVisualEvidence(null);
      else closeVisualBrief();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, evidence, stageB.panel.kind]);

  /* Discuss opens the SAME brief at its Discussion section; Back to brief restores the scroll. */
  useEffect(() => {
    if (!open || evidence !== null) return;
    const body = bodyRef.current;
    if (body === null) return;
    if (section === 'discussion') body.querySelector('#visual-brief-discussion')?.scrollIntoView({ block: 'start' });
    else body.scrollTop = briefScroll.current;
  }, [open, section, evidence, ref, load.kind]);

  if (!open || story === null) return null;
  const t = getDictionary(language).visual.brief;
  const target: StoryTarget = { articleRef: story.articleRef, url: story.url, title: story.title, sourceName: story.sourceName };
  const modal = !wide;
  const view = load.kind === 'ready' ? load.view : null;
  const mayGenerate = view !== null && view.generationAvailable && signedIn && storyId !== null;
  const guestCouldSignIn = view !== null && view.generationAvailable && !signedIn && !isLoading;

  const previewEvidence = (item: VisualEvidenceItem): void => {
    briefScroll.current = bodyRef.current?.scrollTop ?? 0;
    setVisualEvidence(item);
  };

  const actions: VisualBriefActions = {
    prepare: mayGenerate && view?.state === 'NONE' ? () => void run(storyId, 'READ_BRIEF') : null,
    refresh: mayGenerate && view?.state === 'STALE' ? () => void run(storyId, 'STALE_REFRESH') : null,
    retry: mayGenerate && view?.state === 'FAILED' && RETRYABLE.has(view.failureKind) ? () => void run(storyId, 'EXPLICIT_RETRY') : null,
    recheck:
      view?.state === 'CHECKING' && storyId !== null
        ? () => {
            setBusy(true);
            void readStoryBrief(storyId).then((r) => {
              apply(r);
              setBusy(false);
            });
          }
        : null,
    signInHref: guestCouldSignIn ? accountSignInUrl(VISUAL_HOME_HREF) : null,
    busy,
    onPreviewEvidence: (ref) =>
      previewEvidence({ title: ref.title, publisher: ref.publisher, publishedAt: ref.publishedAt, publishedAtBasis: undefined, url: ref.url, summary: null }),
  };

  const askFollowUp = (): void => {
    publishStoryContext(ASK_FOLLOW_UP_OWNER, { title: story.title, url: story.url, sourceName: story.sourceName });
    closeVisualBrief();
    openGlobalAsk();
  };

  const briefVersion =
    view === null ? undefined : view.state === 'NONE' || view.state === 'FAILED' ? undefined : view.state === 'CHECKING' ? view.inspectable?.version : view.brief.version;

  return (
    <>
      {modal && <div aria-hidden="true" data-visual-brief-scrim="" onClick={() => closeVisualBrief()} className="fixed inset-0 z-[60] bg-[var(--gt-scrim)]" />}
      <aside
        role={modal ? 'dialog' : 'complementary'}
        aria-modal={modal ? true : undefined}
        aria-label={fill(t.dialogAria, { title: story.title })}
        data-visual-brief=""
        data-visual-brief-mode={wide ? 'beside' : 'overlay'}
        data-article-ref={story.articleRef}
        data-story-id={storyId ?? undefined}
        data-material-version={identity?.materialVersion ?? undefined}
        data-evidence-revision={view?.currentEvidenceRevision}
        data-brief-version={briefVersion}
        className="fixed bottom-0 end-0 top-0 z-[61] flex w-full flex-col bg-[var(--gt-card)] text-[var(--gt-ink)] shadow-[0_0_40px_-12px_rgba(0,0,0,0.45)] min-[600px]:w-[min(600px,calc(100vw-48px))] min-[900px]:w-[520px] min-[1200px]:top-[60px] min-[1200px]:border-s min-[1200px]:border-[var(--gt-line)] min-[1200px]:shadow-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', bottom: 'var(--gna-kb, 0px)' }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--gt-line)] px-3 py-2">
          {evidence !== null ? (
            <button
              type="button"
              onClick={() => setVisualEvidence(null)}
              data-visual-evidence-back=""
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] px-2 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:bg-[var(--gt-actSoft)]"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
              {t.evidenceBack}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => closeVisualBrief()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] px-2 text-[0.875rem] font-semibold text-[var(--gt-ink)] hover:bg-[var(--gt-sunk)] min-[600px]:hidden"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
              {t.back}
            </button>
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[var(--gt-link)]">{t.label}</span>
          {adminInspect && (
            <a
              href={adminStoryHref({ storyId, articleRef: story.articleRef })}
              data-visual-admin-inspect=""
              className="inline-flex min-h-[44px] items-center gap-1 rounded-[0.5rem] border border-[var(--gt-line)] px-2 text-[0.8125rem] font-semibold text-[var(--gt-ink2)] hover:border-[var(--gt-act)]"
            >
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              {t.inspectInAdmin}
            </a>
          )}
          <button
            type="button"
            onClick={() => closeVisualBrief()}
            aria-label={t.close}
            data-visual-brief-close=""
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--gt-sunk)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-4 min-[600px]:px-6">
          {evidence !== null ? (
            <EvidencePreview item={evidence} language={language} />
          ) : (
            <div className="flex flex-col gap-6">
              <h2 ref={headingRef} tabIndex={-1} dir="auto" className="font-display text-[1.375rem] font-bold leading-snug focus:outline-none">
                {story.title}
              </h2>

              {story.editorial !== undefined && <BriefEditorialContext card={story.editorial} language={language} />}

              {load.kind === 'reading' ? null : load.kind === 'ready' ? (
                <VisualBriefStateView view={load.view} language={language} actions={actions} />
              ) : (
                <UnavailableNotice reason={load.reason} language={language} />
              )}

              <ReportingWeHold story={story} language={language} />

              <section aria-labelledby="visual-brief-evidence">
                <h3 id="visual-brief-evidence" className="text-[1rem] font-bold">
                  {t.evidenceHeading}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    previewEvidence({
                      title: story.title,
                      publisher: story.sourceName,
                      publishedAt: story.publishedAt,
                      publishedAtBasis: story.publishedAtBasis,
                      url: story.url,
                      summary: story.summary,
                    })
                  }
                  data-visual-evidence-row=""
                  className="mt-2 flex min-h-[44px] w-full flex-col items-start gap-0.5 rounded-[0.625rem] border border-[var(--gt-line)] p-3 text-start hover:border-[var(--gt-act)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
                >
                  <span className="text-[0.875rem] font-semibold">
                    <bdi>{story.sourceName}</bdi>
                  </span>
                  <span dir="auto" className="line-clamp-2 text-[0.875rem] text-[var(--gt-ink2)]">
                    {story.title}
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-[var(--gt-link)]">{t.previewEvidence}</span>
                </button>
              </section>

              {discussionRead && (
                <section id="visual-brief-discussion" aria-labelledby="visual-brief-discussion-title" className="scroll-mt-4">
                  <h3 id="visual-brief-discussion-title" className="text-[1rem] font-bold">
                    {t.discussionHeading}
                  </h3>
                  <p data-visual-comments-not-evidence="" className="mt-2 text-[0.875rem] font-semibold text-[var(--gt-ink)]">
                    {t.commentsNotEvidence}
                  </p>
                  <p className="text-[0.8125rem] text-[var(--gt-ink2)]">{t.commentsNotEvidenceNote}</p>
                  <button
                    type="button"
                    data-visual-open-discussion=""
                    onClick={() => openDiscussion(target)}
                    className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] border border-[var(--gt-line)] px-3 text-[0.875rem] font-semibold hover:border-[var(--gt-act)]"
                  >
                    <MessagesSquare aria-hidden="true" className="h-4 w-4" />
                    {stageB.counts[story.articleRef] !== undefined && stageB.counts[story.articleRef] > 0
                      ? `${t.openDiscussion} · ${stageB.counts[story.articleRef]}`
                      : t.openDiscussion}
                  </button>
                </section>
              )}

              <section aria-labelledby="visual-brief-follow" className="flex flex-col gap-2">
                <h3 id="visual-brief-follow" className="text-[1rem] font-bold">
                  {t.followHeading}
                </h3>
                {alertsInApp && (
                  <div>
                    {stageB.alertsByRef[story.articleRef] !== undefined ? (
                      <button
                        type="button"
                        data-visual-alert="on"
                        onClick={() => openAlertsCentre()}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] bg-[var(--gt-amberBg)] px-3 text-[0.875rem] font-semibold text-[var(--gt-amberInk)]"
                      >
                        <BellRing aria-hidden="true" className="h-4 w-4" />
                        {t.alertOn}
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-visual-alert="off"
                        onClick={() => openAlertSetup(target)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] border border-[var(--gt-line)] px-3 text-[0.875rem] font-semibold hover:border-[var(--gt-act)]"
                      >
                        <Bell aria-hidden="true" className="h-4 w-4" />
                        {t.alert}
                      </button>
                    )}
                    <p className="mt-1 text-[0.8125rem] text-[var(--gt-ink2)]">{t.alertNote}</p>
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    data-visual-ask-follow-up=""
                    onClick={askFollowUp}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] bg-[var(--gt-act)] px-3 text-[0.875rem] font-bold text-white hover:brightness-110"
                  >
                    <MessagesSquare aria-hidden="true" className="h-4 w-4" />
                    {t.askFollowUp}
                  </button>
                  <p className="mt-1 text-[0.8125rem] text-[var(--gt-ink2)]">{t.askFollowUpNote}</p>
                </div>
              </section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/** Why there is no Brief to show — named, never blurred into one message. */
function UnavailableNotice({
  reason,
  language,
}: {
  readonly reason: Exclude<BriefResult<never>, { ok: true }>['reason'];
  readonly language: LanguageCode;
}): JSX.Element {
  const t = getDictionary(language).visual.brief;
  const body = reason === 'OFF' ? t.unavailableBody : reason === 'NO_STORY' ? t.noStoryBody : t.readFailedBody;
  return (
    <div data-visual-brief-state="UNAVAILABLE" data-visual-brief-reason={reason} className="rounded-[0.625rem] border border-[var(--gt-line)] bg-[var(--gt-sunk)] p-4">
      <p className="text-[0.9375rem] font-semibold">{t.unavailableTitle}</p>
      <p className="mt-1 text-[0.875rem] leading-[1.5] text-[var(--gt-ink2)]">{body}</p>
    </div>
  );
}

function ReportingWeHold({ story, language }: { readonly story: VisualBriefStory; readonly language: LanguageCode }): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.brief;
  const elapsed = formatObservationalTime(story.publishedAt, story.publishedAtBasis, language);
  return (
    <section aria-labelledby="visual-brief-reporting" data-visual-brief-reporting="">
      <h3 id="visual-brief-reporting" className="text-[1rem] font-bold">
        {t.reportingHeading}
      </h3>
      <p className="mt-2 text-[0.875rem] text-[var(--gt-ink2)]">
        {t.publishedBy} <bdi className="font-semibold text-[var(--gt-ink)]">{story.sourceName}</bdi>
        {elapsed === '' ? '' : ` · ${elapsed}`}
      </p>
      {story.sourcesCount > 1 && (
        <p className="text-[0.875rem] text-[var(--gt-ink2)]">
          {fill(t.providerSources, { count: pluralWithForms(story.sourcesCount, language, dict.homeR1.compare.sourceForms) })}
        </p>
      )}
      {story.summary.trim() !== '' && (
        <figure className="mt-3 border-s-2 border-[var(--gt-line)] ps-3">
          <figcaption className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[var(--gt-ink3)]">{t.publisherSummary}</figcaption>
          <blockquote dir="auto" className="mt-1 text-[0.9375rem] leading-[1.55] text-[var(--gt-ink)]">
            {story.summary}
          </blockquote>
        </figure>
      )}
    </section>
  );
}

/** The INTERNAL evidence preview. Only "Read Original ↗" leaves GlobalNewsAI. */
function EvidencePreview({ item, language }: { readonly item: VisualEvidenceItem; readonly language: LanguageCode }): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.brief;
  const elapsed = item.publishedAt === null ? '' : formatObservationalTime(item.publishedAt, item.publishedAtBasis, language);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <div data-visual-evidence-preview="" className="flex flex-col gap-3">
      <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[var(--gt-ink3)]">{t.evidenceTitle}</p>
      <h2 ref={headingRef} tabIndex={-1} dir="auto" className="font-display text-[1.25rem] font-bold leading-snug focus:outline-none">
        {item.title}
      </h2>
      <p className="text-[0.875rem] text-[var(--gt-ink2)]">
        <bdi className="font-semibold text-[var(--gt-ink)]">{item.publisher}</bdi>
        {elapsed === '' ? '' : ` · ${elapsed}`}
      </p>
      {item.summary !== null && item.summary.trim() !== '' && (
        <figure className="border-s-2 border-[var(--gt-line)] ps-3">
          <figcaption className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[var(--gt-ink3)]">{t.publisherSummary}</figcaption>
          <blockquote dir="auto" className="mt-1 text-[0.9375rem] leading-[1.55]">
            {item.summary}
          </blockquote>
        </figure>
      )}
      <p className="text-[0.8125rem] text-[var(--gt-ink2)]">{t.evidenceNote}</p>
      {item.url !== null && (
        <a
          href={safeExternalHref(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          data-visual-evidence-read-original=""
          aria-label={fill(dict.visual.stories.readOriginalAria, { publisher: item.publisher })}
          className="inline-flex min-h-[44px] w-fit items-center gap-1 rounded-[0.5rem] border border-[var(--gt-line)] px-3 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:border-[var(--gt-act)]"
        >
          {dict.visual.stories.readOriginal}
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

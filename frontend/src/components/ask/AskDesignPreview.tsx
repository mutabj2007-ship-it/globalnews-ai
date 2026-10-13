import type { JSX, ReactNode } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { r28PreviewStrings, r28PreviewStringsFellBack } from '@/lib/ask/r28PreviewStrings';
import tokens from '../account/settingsTokens.module.css';
import styles from './r28.module.css';

/**
 * CTO R28 — THE REMAINING APPROVED ASK R3 PRESETS, AS LABELLED DESIGN PREVIEWS (Alpha only).
 *
 * The R3 81-preset matrix (ASK-R3-RELEASE/01) left 23 presets unbuilt because a backend or rights
 * capability does not exist yet. They are drawn here, from the approved Design package, as STATIC,
 * NON-ACTIONABLE previews so the Product Owner can see them on Alpha:
 *
 *   D10 / D11  contextual map and route   — needs a geographic-evidence contract
 *   D14        scheduled check            — needs an authorized scheduler
 *   J02–J05    job opportunities          — needs an admitted job-listing source with cleared rights
 *   P02        research progress states   — needs real backend stage events
 *
 * Nothing here is live and nothing pretends to be: a page-level banner and a per-section badge say
 * so, every sample is fictional ("Sample place", "Example employer"), the map is an abstract
 * schematic with no real geometry, every control is a disabled <button> and there is no link, no
 * fetch, no account call, no image and no animation. The route (app/ask/preview) is a 404 on the
 * standalone (Production) root, exactly like `/visual`.
 */
export function AskDesignPreview({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const s = r28PreviewStrings(locale);
  /* Fallback copy is English: say so (lang) and let each English paragraph take its own direction
     (data-copy-fallback → unicode-bidi: plaintext), while the layout keeps the reader's direction. */
  const fellBack = r28PreviewStringsFellBack(locale);
  const direction = askDirectionProps(locale);
  return (
    <main
      data-ask="design-preview"
      data-copy-fallback={fellBack ? 'en' : undefined}
      className={`${tokens.settingsScope} ${styles.page}`}
      dir={direction.dir}
      lang={fellBack ? 'en' : direction.lang}
    >
      <div className={styles.inner}>
        <p role="note" data-ask="preview-banner" className={styles.banner}>
          {s.banner}
        </p>
        <h1 className={styles.title}>{s.title}</h1>

        {/* ── (A) D10 / D11 — contextual map and route ─────────────────────────────── */}
        <Section id="map" title={s.mapTitle} reason={s.mapReason} badge={s.badge}>
          <figure data-preset="D10-map-region D10-marker" className={styles.card}>
            <svg viewBox="0 0 320 140" role="img" aria-label={s.mapSchematic} className={styles.schematic}>
              <rect x="1" y="1" width="318" height="138" rx="12" className={styles.svgFrame} />
              <path d="M40 92 C70 40 130 34 160 60 S250 104 284 52" className={styles.svgArea} />
              <circle cx="96" cy="70" r="7" className={styles.svgMarker} />
              <circle cx="214" cy="84" r="7" className={styles.svgMarker} />
              <circle cx="262" cy="58" r="5" className={styles.svgMarkerSoft} />
            </svg>
            <figcaption className={styles.caption}>{s.mapSchematic}</figcaption>
          </figure>
          <div data-preset="D10-map-list" className={styles.card}>
            <p className={styles.cardTitle}>{s.mapListTitle}</p>
            <ul className={styles.list}>
              {['A', 'B', 'C'].map((k) => (
                <li key={k} className={styles.listRow}>
                  <span>{`${s.sample} place ${k}`}</span>
                  <Disabled label={s.badge} />
                </li>
              ))}
            </ul>
          </div>
          <div data-preset="D10-map-place" className={styles.card}>
            <p className={styles.cardTitle}>{s.mapPlaceTitle}</p>
            <p className={styles.small}>{s.mapPlaceBody}</p>
          </div>
          <div data-preset="D11-route D11-route-edit D11-place" className={styles.card}>
            <p className={styles.cardTitle}>{s.routeTitle}</p>
            <p className={styles.small}>{s.routeBody}</p>
            <p className={styles.small}>{s.routeFollowedPlace}</p>
            <Disabled label={s.routeEdit} />
          </div>
        </Section>

        {/* ── (B) D14 — scheduled check ─────────────────────────────────────────────── */}
        <Section id="schedule" title={s.scheduleTitle} reason={s.scheduleReason} badge={s.badge}>
          <div data-preset="D14-schedule" className={styles.card}>
            <p className={styles.cardTitle}>{s.scheduleToggle}</p>
            <div className={styles.row}>
              <Disabled label={s.scheduleDaily} />
              <Disabled label={s.scheduleWeekly} />
            </div>
            <p className={styles.small}>{s.scheduleBody}</p>
          </div>
        </Section>

        {/* ── (C) J02–J05 — job opportunities, fictional samples only ───────────────── */}
        <Section id="jobs" title={s.jobsTitle} reason={s.jobsReason} badge={s.badge}>
          <ol data-preset="J02-active J02-next" className={`${styles.card} ${styles.stages}`}>
            <li className={styles.stageDone}>
              <span aria-hidden="true">✓</span> {s.jobsActiveDone}
            </li>
            <li className={styles.stageActive}>
              <span aria-hidden="true">•</span> {s.jobsNext}
            </li>
          </ol>
          {[1, 2].map((n) => (
            <div key={n} data-preset="J03-results" className={styles.card}>
              <p className={styles.cardTitle}>{`${s.jobsRole} ${n}`}</p>
              <p className={styles.small}>{`${s.jobsEmployer} · ${s.jobsPlace}`}</p>
              <p className={styles.small}>{s.jobsDeadline}</p>
              <p className={styles.small}>{`${s.jobsSource} · ${s.jobsChecked}`}</p>
              <div className={styles.row}>
                <Disabled label={s.jobsDetails} />
                <Disabled label={s.jobsSave} />
              </div>
            </div>
          ))}
          <div data-preset="J03-detail" className={styles.card}>
            <p className={styles.cardTitle}>{s.jobsDetailTitle}</p>
            <p className={styles.small}>{s.jobsDetailBody}</p>
          </div>
          <div data-preset="J04-source J04-handoff" className={styles.card}>
            <p className={styles.cardTitle}>{s.jobsSourceTitle}</p>
            <p className={styles.small}>{s.jobsSourceBody}</p>
            <Disabled label={s.jobsHandoff} />
          </div>
          <div data-preset="J05-follow J05-updates J05-change" className={styles.card}>
            <Disabled label={s.jobsFollow} />
            <p className={styles.small}>{s.jobsUpdate}</p>
            <p className={styles.small}>{s.jobsChange}</p>
          </div>
        </Section>

        {/* ── (D) P02 — research progress states, static frames ─────────────────────── */}
        <Section id="progress" title={s.progressTitle} reason={s.progressReason} badge={s.badge}>
          <p className={styles.small}>{s.progressIllustration}</p>
          <ol className={`${styles.card} ${styles.stages}`}>
            <li data-preset="P02-slow" className={styles.stageActive}>
              <span aria-hidden="true">•</span> {s.progressSlow}
            </li>
            <li data-preset="P02-cancelled" className={styles.stageStopped}>
              <span aria-hidden="true">×</span> {s.progressCancelled}
            </li>
            <li data-preset="P02-retry" className={styles.stageStopped}>
              <Disabled label={s.progressRetry} /> <span className={styles.small}>{s.progressRetryNote}</span>
            </li>
            <li data-preset="P02-reduced" className={styles.small}>
              {s.progressReduced}
            </li>
            <li data-preset="P02-keyboard" className={styles.small}>
              {s.progressKeyboard}
            </li>
            <li data-preset="P02-single" className={styles.stageActive}>
              <span aria-hidden="true">•</span> {s.progressSingle} <span className={styles.small}>{s.progressSingleNote}</span>
            </li>
          </ol>
        </Section>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  reason,
  badge,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
  readonly badge: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section data-ask="preview-section" data-preview-section={id} aria-labelledby={`r28-${id}`} className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id={`r28-${id}`} className={styles.sectionTitle}>
          {title}
        </h2>
        <span data-ask="preview-badge" className={styles.badge}>
          {badge}
        </span>
      </div>
      <p data-ask="preview-reason" className={styles.small}>
        {reason}
      </p>
      {children}
    </section>
  );
}

/** Every action on this page is inert: a real, disabled button that does nothing. */
function Disabled({ label }: { readonly label: string }): JSX.Element {
  return (
    <button type="button" disabled aria-disabled="true" data-ask="preview-action" className={styles.action}>
      {label}
    </button>
  );
}

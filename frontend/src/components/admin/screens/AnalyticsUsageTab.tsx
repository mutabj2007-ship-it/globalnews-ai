'use client';

import { useAdminContext } from '../shell/AdminContext';
import {
  NOT_IMPLEMENTED,
  UNAVAILABLE,
  sectionNumber,
  sectionState,
} from '@/lib/admin/adminDataState';
import { ADMIN_API } from '@/lib/admin/adminRoutes';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import type { AdminAnalyticsUsageResponse } from '@/lib/admin/adminApiTypes';
import { AdminDataTable } from '../primitives/AdminDataTable';
import { AdminPanel } from '../primitives/AdminPanel';
import { KpiCard } from '../primitives/KpiCard';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';

/**
 * ADMIN-03 — the usage tab, and the first admin screen whose numbers are
 * real.
 *
 * WHAT IS LIVE HERE AND WHAT IS NOT IS THE ENTIRE DESIGN OF THIS FILE.
 * Accounts, analysis runs and recorded product events come from
 * GET /admin/analytics/usage. Active users, sessions, top languages,
 * client errors and retention cohorts do NOT, because this platform
 * persists nothing they could be computed from, and they stay in their
 * unavailable and not-implemented states sitting directly beside the
 * live ones.
 *
 * THAT ADJACENCY IS THE RISK THIS SCREEN HAS TO SURVIVE. A live
 * "recorded return visits" card next to an empty "active users" card is
 * precisely the situation in which somebody points the empty card at the
 * live number. They measure different things — one counts accounts that
 * reached the return surface, the other would have to count everybody
 * including the anonymous majority — so they are separate provenance
 * keys with separate tags, and the note under the row says what the live
 * one actually counts.
 *
 * NOT "AI QUESTIONS". An AnalysisRun row is one request the server
 * completed, cached responses and failures included. The label says
 * analysis runs because that is what the table holds.
 */
export function AnalyticsUsageTab(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.analytics;
  const usage = useAdminResource<AdminAnalyticsUsageResponse>(ADMIN_API.analyticsUsage);

  const accounts = usage.data?.accounts ?? null;
  const analysis = usage.data?.analysis ?? null;
  const events = usage.data?.events ?? null;

  const accountValue = (value: number | undefined): ReturnType<typeof sectionNumber> =>
    sectionNumber(usage.state, accounts, value);
  const analysisValue = (value: number | undefined): ReturnType<typeof sectionNumber> =>
    sectionNumber(usage.state, analysis, value);

  const eventsState = sectionState(usage.state, events);
  const analysisState = sectionState(usage.state, analysis);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-3 adm-full:grid-cols-6">
        <KpiCard
          label={screen.kpis.totalAccounts}
          field="admin-03.userRecords"
          data={accountValue(accounts?.total)}
          onRetry={usage.reload}
        />
        <KpiCard
          label={screen.kpis.newUsers}
          field="admin-03.newUsers"
          data={accountValue(accounts?.createdLast7d)}
          onRetry={usage.reload}
        />
        <KpiCard
          label={screen.kpis.returning}
          field="admin-03.observedReturnVisits"
          data={accountValue(accounts?.observedReturningLast7d)}
          onRetry={usage.reload}
        />
        <KpiCard
          label={screen.kpis.analysisRuns}
          field="admin-03.analysisRuns"
          data={analysisValue(analysis?.runsLast24h)}
          onRetry={usage.reload}
        />
        {/*
          THE TWO THAT STAY EMPTY, AND KEEP THEIR OWN PROVENANCE KEYS.
          Neither is wired to anything, and neither may borrow a number
          from the cards beside it.
        */}
        <KpiCard
          label={screen.kpis.activeUsers}
          field="admin-03.activeReturning"
          data={UNAVAILABLE}
        />
        <KpiCard
          label={screen.kpis.clientErrors}
          field="admin-03.clientErrors"
          data={NOT_IMPLEMENTED}
        />
      </div>

      <p className="text-[11px] leading-relaxed text-adm-ink-dim">{screen.returningMeaning}</p>

      <AdminPanel
        title={screen.analysisTitle}
        field="admin-03.analysisRuns"
        note={screen.analysisPurpose}
      >
        <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-3">
          <KpiCard
            label={screen.analysisCacheHits}
            field="admin-03.analysisRuns"
            data={analysisValue(analysis?.cacheHits)}
            onRetry={usage.reload}
          />
          <KpiCard
            label={screen.analysisCacheMisses}
            field="admin-03.analysisRuns"
            data={analysisValue(analysis?.cacheMisses)}
            onRetry={usage.reload}
          />
          <KpiCard
            label={screen.analysisSample}
            field="admin-03.analysisRuns"
            data={analysisValue(analysis?.latency.sampleCount)}
            onRetry={usage.reload}
          />
        </div>

        {/*
          THE SAMPLE SIZE TRAVELS WITH THE AVERAGE, ALWAYS. latencyMs is
          nullable, so a mean over it is a mean over an unknown subset
          unless the subset size is beside it. When nothing was sampled
          the aggregate is ABSENT from the payload and this renders the
          sentence saying so, rather than a zero nobody measured.
        */}
        <p className="mt-3 text-[11px] leading-relaxed text-adm-ink-dim">
          {analysis && analysis.latency.sampleCount > 0
            ? `${screen.analysisLatency}: ${screen.analysisAverage} ${String(
                analysis.latency.averageMs,
              )}ms · ${screen.analysisRange} ${String(analysis.latency.minMs)}ms – ${String(
                analysis.latency.maxMs,
              )}ms`
            : screen.analysisNoSample}
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <AdminDataTable
            caption={screen.analysisOutcome}
            state={analysisState}
            rows={analysis?.byStatus ?? []}
            rowKey={(row) => row.key}
            emptyTitle={screen.analysisOutcome}
            emptyBody={screen.analysisNoSample}
            onRetry={usage.reload}
            columns={[
              { id: 'key', header: screen.analysisOutcome, render: (row) => row.key },
              {
                id: 'count',
                header: screen.analysisSample,
                align: 'right',
                render: (row) => String(row.count),
              },
            ]}
          />

          <AdminDataTable
            caption={screen.analysisFailureReason}
            state={analysisState}
            rows={analysis?.byFailureReason ?? []}
            rowKey={(row) => row.key}
            emptyTitle={screen.analysisFailureReason}
            emptyBody={screen.analysisNoSample}
            onRetry={usage.reload}
            columns={[
              { id: 'key', header: screen.analysisFailureReason, render: (row) => row.key },
              {
                id: 'count',
                header: screen.analysisSample,
                align: 'right',
                render: (row) => String(row.count),
              },
            ]}
          />

          <AdminDataTable
            caption={screen.analysisProvider}
            state={analysisState}
            rows={analysis?.byProvider ?? []}
            rowKey={(row, index) => `${row.provider}:${row.model ?? ''}:${String(index)}`}
            emptyTitle={screen.analysisProvider}
            emptyBody={screen.analysisNoSample}
            onRetry={usage.reload}
            columns={[
              { id: 'provider', header: screen.analysisProvider, render: (row) => row.provider },
              {
                id: 'model',
                header: screen.analysisProvider,
                secondary: true,
                render: (row) => row.model ?? screen.usersNoRole,
              },
              {
                id: 'count',
                header: screen.analysisSample,
                align: 'right',
                render: (row) => String(row.count),
              },
            ]}
          />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-adm-ink-dim">
          {screen.mockProviderNote}
        </p>
      </AdminPanel>

      <AdminPanel
        title={screen.recordedEventsTitle}
        field="admin-03.featureUsage"
        note={screen.recordedEventsPurpose}
      >
        {/*
          THE DISCLOSURE IS PART OF THE PANEL, NOT A FOOTNOTE UNDER IT.
          Five of the twelve declared event names have a producer. The
          other seven describe client interactions and nothing emits
          them, so they are missing from the data rather than unused, and
          ranking what remains as "top features" would be false. The two
          lists come from the API, which derives them from the emitter
          call sites, so this cannot quietly go stale.
        */}
        <div className="mb-3 rounded-lg border border-adm-chip-warn-edge bg-adm-chip-warn-bg px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-adm-chip-warn-ink">
            {screen.instrumentationGapTitle}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-adm-chip-warn-ink">
            {screen.instrumentationGapBody}
          </p>
          {events && (
            <dl className="mt-2 flex flex-col gap-1 font-cd-mono text-[10px] text-adm-chip-warn-ink">
              <div className="flex flex-wrap gap-2">
                <dt>{screen.hasProducer}:</dt>
                <dd>{events.instrumentedEventNames.join(', ')}</dd>
              </div>
              <div className="flex flex-wrap gap-2">
                <dt>{screen.noProducer}:</dt>
                <dd>{events.uninstrumentedEventNames.join(', ')}</dd>
              </div>
            </dl>
          )}
        </div>

        <AdminDataTable
          caption={screen.recordedEventsTitle}
          state={eventsState}
          rows={events?.recorded ?? []}
          rowKey={(row) => row.key}
          emptyTitle={screen.recordedEventsTitle}
          emptyBody={screen.instrumentationGapBody}
          onRetry={usage.reload}
          columns={[
            { id: 'key', header: screen.recordedEventsTitle, render: (row) => row.key },
            {
              id: 'count',
              header: screen.analysisSample,
              align: 'right',
              render: (row) => String(row.count),
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel title={screen.retentionDisclosureTitle} field="admin-03.analysisRuns">
        {/*
          R3/T7 declares 90-day retention for both telemetry tables and
          NOTHING ENFORCES IT: there is no scheduler in this backend and
          no purge job. That gap was tolerable while nothing read these
          tables. Presenting them makes it a property of the product, so
          it is stated here rather than left in a schema comment.
        */}
        <p className="text-[11px] leading-relaxed text-adm-ink-dim">
          {screen.retentionDeclared}: {String(usage.data?.retention.declaredDays ?? '')}
        </p>
        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-adm-chip-warn-ink">
          {usage.data?.retention.enforced
            ? screen.retentionIsEnforced
            : screen.retentionNotEnforced}
        </p>
      </AdminPanel>

      {/*
        STILL EMPTY, AND EACH KEEPS ITS OWN REASON. Sessions cannot be
        counted historically because the rows are deleted; languages are
        never persisted; cohorts need an activity time series that does
        not exist and cannot be reconstructed after the fact.
      */}
      <div className="grid grid-cols-1 gap-4 adm-rail:grid-cols-2 adm-full:grid-cols-3">
        <PlaceholderPanel
          title={screen.kpis.sessions}
          purpose={screen.purpose}
          requirement={screen.sessionsRequirement}
          field="admin-03.activeReturning"
          ratio="min-h-[160px]"
        />
        <PlaceholderPanel
          title={screen.topLanguages}
          purpose={screen.purpose}
          requirement={screen.errorsRequirement}
          field="admin-03.languagePerSession"
          ratio="min-h-[160px]"
        />
        <PlaceholderPanel
          title={screen.retentionTitle}
          purpose={screen.retentionPurpose}
          requirement={screen.retentionRequirement}
          field="admin-03.retention"
          ratio="min-h-[160px]"
        />
      </div>
    </>
  );
}

'use client';

import { useAdminContext } from '../shell/AdminContext';
import { sectionNumber, sectionState, type AdminDataState } from '@/lib/admin/adminDataState';
import { ADMIN_API } from '@/lib/admin/adminRoutes';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import type {
  AdminAskAlert,
  AdminAskAlertSeverity,
  AdminAskBreakerRow,
  AdminAskCount,
  AdminAskEvidenceRole,
  AdminAskIntelligenceResponse,
  AdminAskSwitchRow,
} from '@/lib/admin/adminApiTypes';
import { AdminDataTable, type AdminColumn } from '../primitives/AdminDataTable';
import { AdminPanel } from '../primitives/AdminPanel';
import { KpiCard } from '../primitives/KpiCard';
import { StatusChip, type ChipTone } from '../primitives/StatusChip';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA OPERATIONS MINIMUM R1 — THE OPERATIONS PAGE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * COMPACT ON PURPOSE. Four groups and an alert list: can readers Ask, what capability did
 * they not get, what is refusing them, and what should be fixed next. The telemetry behind
 * it records more than this — language, domain, geography, intent — and those reach the
 * screen only where they name something to fix. An operations page an operator will not
 * read during an incident is not an operations page.
 *
 * NO QUESTION REACHES THIS FILE, AND NONE CAN. The response type carries no field for a
 * question, a query, an account or an address, so there is nothing here to render even by
 * mistake. Every value below is a count against a machine key.
 *
 * A NULL SECTION IS AN ERROR, NEVER A ZERO. The backend returns null for a section whose
 * read FAILED, and `sectionState` turns that into the `error` state so the panel renders a
 * retry. An operations page that shows a healthy zero because the database was unreachable
 * is worse than one that shows nothing, because an operator believes it.
 *
 * EVERY WORD COMES FROM THE DICTIONARY. Machine keys — `CURRENT_REPORTING`, `BUDGET_*`,
 * `CIRCUIT_OPEN` — are rendered verbatim because they are the same identifiers the backend
 * and the router use; translating them would break the mapping between what an operator
 * reads here and what they grep for in a log.
 */
/*
  NO SEVERITY MAPS TO THE HEALTHY TONE EXCEPT `OK`.

  `INSUFFICIENT_SAMPLE` and `UNKNOWN` get distinct non-green tones rather than sharing one:
  "not enough traffic yet" and "could not measure" are different facts, and an operator
  reading an amber page at 3am needs to know which of the two they are looking at.
*/
const SEVERITY_TONE: Record<AdminAskAlertSeverity, ChipTone> = {
  OK: 'good',
  WARNING: 'warn',
  CRITICAL: 'bad',
  INSUFFICIENT_SAMPLE: 'info',
  UNKNOWN: 'mute',
};

/**
 * A ratio is shown as a percentage; everything else is shown as the integer it is.
 *
 * ROUNDING A RATIO TO AN INTEGER IS HOW A THREE-QUARTERS-FULL HOUR GETS RENDERED AS `0`.
 * Every saturation line carries `unit: 'RATIO'` for exactly that reason; what its ceiling
 * counts is a separate field and is shown beside it.
 */
function formatObserved(alert: AdminAskAlert): string {
  if (alert.observed === null) return '—';
  if (alert.unit === 'RATIO') return `${Math.round(alert.observed * 1000) / 10}%`;
  return String(Math.round(alert.observed));
}

function formatThreshold(value: number, unit: string): string {
  return unit === 'RATIO' ? `${Math.round(value * 1000) / 10}%` : String(value);
}

/**
 * THE CAPABILITY IS CHECKED BEFORE THE READER IS MOUNTED, NOT AFTER IT HAS FETCHED.
 *
 * That is why this is two components rather than one. A hook cannot be called
 * conditionally, so a single component would have to call `useAdminResource` and only then
 * decide whether the caller may see the result — which means the request has already gone
 * to the server for data the caller may not hold. Gating in the parent and holding the hook
 * in the child makes "not authorized" mean "never asked", and it is the same split the
 * landed analytics screen uses.
 */
export function AskIntelligenceScreen(): JSX.Element {
  const { t, can } = useAdminContext();
  if (!can('analytics.view')) return <p>{t.access.forbiddenBody}</p>;
  return <AskIntelligencePanels />;
}

function AskIntelligencePanels(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.askIntelligence;
  const resource = useAdminResource<AdminAskIntelligenceResponse>(ADMIN_API.askIntelligence);

  const data = resource.data;
  const health = data?.health ?? null;
  const evidence = data?.evidence ?? null;
  const operations = data?.operations ?? null;
  const improvement = data?.improvement ?? null;
  const alerts = data?.alerts ?? null;

  const healthState = sectionState(resource.state, health);
  const evidenceState = sectionState(resource.state, evidence);
  const operationsState = sectionState(resource.state, operations);
  const improvementState = sectionState(resource.state, improvement);
  const alertsState = sectionState(resource.state, alerts);

  const healthValue = (value: number | undefined): ReturnType<typeof sectionNumber> =>
    sectionNumber(resource.state, health, value);

  const countColumns = (header: string): ReadonlyArray<AdminColumn<AdminAskCount>> => [
    { id: 'key', header, render: (row) => <span className="font-cd-mono">{row.key}</span> },
    { id: 'count', header: screen.alerts.observed, align: 'right', render: (row) => row.count },
  ];

  const countTable = (
    caption: string,
    header: string,
    rows: readonly AdminAskCount[],
    state: AdminDataState,
    emptyTitle: string,
    emptyBody: string,
  ): JSX.Element => (
    <AdminDataTable<AdminAskCount>
      caption={caption}
      columns={countColumns(header)}
      rows={rows}
      state={state}
      emptyTitle={emptyTitle}
      emptyBody={emptyBody}
      rowKey={(row) => row.key}
      onRetry={resource.reload}
    />
  );

  const alertColumns: ReadonlyArray<AdminColumn<AdminAskAlert>> = [
    {
      id: 'id',
      header: screen.alerts.title,
      render: (row) => <span className="font-cd-mono">{row.id}</span>,
    },
    {
      id: 'severity',
      header: screen.alerts.severity,
      render: (row) => <StatusChip label={row.severity} tone={SEVERITY_TONE[row.severity]} />,
    },
    {
      id: 'observed',
      header: screen.alerts.observed,
      align: 'right',
      render: (row) => <span className="font-cd-mono">{formatObserved(row)}</span>,
    },
    {
      id: 'warnAt',
      header: screen.alerts.warnAt,
      align: 'right',
      secondary: true,
      render: (row) => (
        <span className="font-cd-mono">{formatThreshold(row.warnAt, row.unit)}</span>
      ),
    },
    {
      id: 'criticalAt',
      header: screen.alerts.criticalAt,
      align: 'right',
      secondary: true,
      render: (row) => (
        <span className="font-cd-mono">{formatThreshold(row.criticalAt, row.unit)}</span>
      ),
    },
    {
      id: 'ceiling',
      header: screen.alerts.ceiling,
      align: 'right',
      secondary: true,
      render: (row) => (
        <span className="font-cd-mono">{row.ceiling === null ? '—' : row.ceiling}</span>
      ),
    },
    {
      id: 'source',
      header: screen.alerts.source,
      secondary: true,
      render: (row) => <span className="font-cd-mono text-adm-ink-dim">{row.thresholdSource}</span>,
    },
    {
      id: 'samples',
      header: screen.alerts.samples,
      align: 'right',
      secondary: true,
      render: (row) => <span className="font-cd-mono">{row.sampleCount}</span>,
    },
  ];

  const evidenceColumns: ReadonlyArray<AdminColumn<AdminAskEvidenceRole>> = [
    {
      id: 'role',
      header: screen.evidence.role,
      render: (row) => <span className="font-cd-mono">{row.role}</span>,
    },
    {
      id: 'requested',
      header: screen.evidence.requested,
      align: 'right',
      render: (row) => row.requested,
    },
    {
      id: 'obtained',
      header: screen.evidence.obtained,
      align: 'right',
      render: (row) => row.obtained,
    },
    {
      id: 'unavailable',
      header: screen.evidence.unavailable,
      align: 'right',
      render: (row) => row.unavailable,
    },
  ];

  const switchColumns: ReadonlyArray<AdminColumn<AdminAskSwitchRow>> = [
    {
      id: 'name',
      header: screen.operations.switches,
      render: (row) => <span className="font-cd-mono">{row.name}</span>,
    },
    {
      id: 'effective',
      header: screen.operations.switchEffective,
      render: (row) =>
        row.readable ? (
          <StatusChip label={String(row.effective)} tone={row.effective ? 'good' : 'mute'} />
        ) : (
          <StatusChip label={screen.operations.switchUnreadable} tone="warn" />
        ),
    },
    {
      id: 'deployment',
      header: screen.operations.switchDeployment,
      secondary: true,
      render: (row) => (
        <span className="font-cd-mono">{String(row.deploymentValueIsLiteralTrue)}</span>
      ),
    },
    {
      id: 'row',
      header: screen.operations.switchRow,
      secondary: true,
      render: (row) => (
        <span className="font-cd-mono">{row.rowPresent ? String(row.rowEnabled) : '—'}</span>
      ),
    },
  ];

  const breakerColumns: ReadonlyArray<AdminColumn<AdminAskBreakerRow>> = [
    {
      id: 'provider',
      header: screen.operations.breakers,
      render: (row) => <span className="font-cd-mono">{row.provider}</span>,
    },
    {
      id: 'state',
      header: screen.operations.breakerState,
      render: (row) => (
        <StatusChip label={row.state} tone={row.state === 'CLOSED' ? 'good' : 'bad'} />
      ),
    },
    {
      id: 'openUntil',
      header: screen.operations.breakerOpenUntil,
      secondary: true,
      render: (row) => <span className="font-cd-mono">{row.openUntil ?? '—'}</span>,
    },
    {
      id: 'trials',
      header: screen.operations.breakerTrials,
      align: 'right',
      secondary: true,
      render: (row) => row.trialsInFlight,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <p className="rounded-lg border border-adm-chip-info-edge bg-adm-chip-info-bg px-3.5 py-2.5 text-[11px] leading-relaxed text-adm-chip-info-ink">
        {screen.privacyNotice}
      </p>

      <AdminPanel
        title={screen.alerts.title}
        field="admin-06.askAlerts"
        note={screen.alerts.purpose}
        actions={
          alerts ? (
            <StatusChip
              label={alerts.worstSeverity}
              tone={SEVERITY_TONE[alerts.worstSeverity]}
              title={screen.alerts.severity}
            />
          ) : undefined
        }
      >
        <AdminDataTable<AdminAskAlert>
          caption={screen.alerts.title}
          columns={alertColumns}
          rows={alerts?.alerts ?? []}
          state={alertsState}
          emptyTitle={screen.alerts.emptyTitle}
          emptyBody={screen.alerts.emptyBody}
          rowKey={(row) => row.id}
          onRetry={resource.reload}
        />
        <p className="text-[11px] leading-relaxed text-adm-ink-dim">
          {screen.alerts.procedureNote}
        </p>
        <p className="font-cd-mono text-[11px] text-adm-ink-3">
          {screen.alerts.procedure}
          {': '}
          {alerts?.procedureDocument ?? '—'}
        </p>
      </AdminPanel>

      <AdminPanel
        title={screen.health.title}
        field="admin-06.askHealth"
        note={screen.health.purpose}
      >
        <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-3 adm-full:grid-cols-5">
          <KpiCard
            label={screen.health.attempts}
            field="admin-06.askHealth"
            data={healthValue(health?.attemptsLast24h)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.executions}
            field="admin-06.askHealth"
            data={healthValue(health?.executionsLast24h)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.completions}
            field="admin-06.askHealth"
            data={healthValue(health?.completionsLast24h)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.failures}
            field="admin-06.askHealth"
            data={healthValue(health?.failuresLast24h)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.zeroModel}
            field="admin-06.askHealth"
            data={healthValue(health?.zeroModelLast24h)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.modelCalls}
            field="admin-06.askHealth"
            data={healthValue(health?.modelInvocationsLast24h)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.providerCalls}
            field="admin-06.askHealth"
            data={healthValue(health?.providerCallsLast24h)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.reused}
            field="admin-06.askHealth"
            data={healthValue(health?.storedResultReusedLast7d)}
            onRetry={resource.reload}
          />
          {/*
            THE SAMPLE COUNT TRAVELS WITH EVERY ORDER STATISTIC. Latency is nullable, so a
            median over it is a median over an unknown subset unless the subset size is
            beside it — and a p95 over three rows is not a p95.
          */}
          <KpiCard
            label={screen.health.latencySamples}
            field="admin-06.askHealth"
            data={healthValue(health?.latency.sampleCount)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.latencyMedian}
            field="admin-06.askHealth"
            data={healthValue(health?.latency.sampleCount ? health.latency.medianMs : undefined)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.latencyP95}
            field="admin-06.askHealth"
            data={healthValue(health?.latency.sampleCount ? health.latency.p95Ms : undefined)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.tokenSamples}
            field="admin-06.askHealth"
            data={healthValue(health?.tokens.sampleCount)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.promptTokens}
            field="admin-06.askHealth"
            data={healthValue(health?.tokens.sampleCount ? health.tokens.promptTokens : undefined)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.completionTokens}
            field="admin-06.askHealth"
            data={healthValue(
              health?.tokens.sampleCount ? health.tokens.completionTokens : undefined,
            )}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.clarification}
            field="admin-06.askHealth"
            data={healthValue(health?.clarificationRequiredLast7d)}
            onRetry={resource.reload}
          />
          <KpiCard
            label={screen.health.capabilityUnavailable}
            field="admin-06.askHealth"
            data={healthValue(health?.capabilityUnavailableLast7d)}
            onRetry={resource.reload}
          />
        </div>

        <p className="text-[11px] leading-relaxed text-adm-ink-dim">{screen.health.attemptsNote}</p>

        {countTable(
          screen.health.answerStates,
          screen.health.answerStates,
          health?.byAnswerState ?? [],
          healthState,
          screen.operations.emptyTitle,
          screen.operations.emptyBody,
        )}
      </AdminPanel>

      <AdminPanel
        title={screen.evidence.title}
        field="admin-06.askEvidence"
        note={screen.evidence.purpose}
      >
        <AdminDataTable<AdminAskEvidenceRole>
          caption={screen.evidence.title}
          columns={evidenceColumns}
          rows={evidence?.roles ?? []}
          state={evidenceState}
          emptyTitle={screen.evidence.emptyTitle}
          emptyBody={screen.evidence.emptyBody}
          rowKey={(row) => row.role}
          onRetry={resource.reload}
        />
        <p className="text-[11px] leading-relaxed text-adm-ink-dim">{screen.evidence.note}</p>
        <p className="font-cd-mono text-[11px] text-adm-ink-dim">
          {screen.evidence.reserved}
          {': '}
          {(evidence?.reservedInactiveRoles ?? []).join(', ') || '—'}
        </p>
        <p className="font-cd-mono text-[11px] text-adm-ink-dim">
          {screen.evidence.supplied}
          {': '}
          {(evidence?.executorSuppliedRoles ?? []).join(', ') || '—'}
        </p>
      </AdminPanel>

      <AdminPanel
        title={screen.operations.title}
        field="admin-06.askOperations"
        note={screen.operations.purpose}
      >
        <AdminDataTable<AdminAskSwitchRow>
          caption={screen.operations.switches}
          columns={switchColumns}
          rows={operations?.switches ?? []}
          state={operationsState}
          emptyTitle={screen.operations.emptyTitle}
          emptyBody={screen.operations.emptyBody}
          rowKey={(row) => row.name}
          onRetry={resource.reload}
        />
        <p className="text-[11px] leading-relaxed text-adm-ink-dim">
          {screen.operations.switchNote}
        </p>

        <AdminDataTable<AdminAskBreakerRow>
          caption={screen.operations.breakers}
          columns={breakerColumns}
          rows={operations?.breakers ?? []}
          state={operationsState}
          emptyTitle={screen.operations.emptyTitle}
          emptyBody={screen.operations.emptyBody}
          rowKey={(row) => row.provider}
          onRetry={resource.reload}
        />

        <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-2">
          {countTable(
            screen.operations.budgetRejections,
            screen.operations.budgetRejections,
            operations?.budgetRejections ?? [],
            operationsState,
            screen.operations.emptyTitle,
            screen.operations.emptyBody,
          )}
          {countTable(
            screen.operations.providerErrors,
            screen.operations.providerErrors,
            operations?.providerErrors ?? [],
            operationsState,
            screen.operations.emptyTitle,
            screen.operations.emptyBody,
          )}
          {countTable(
            screen.operations.failureCodes,
            screen.operations.failureCodes,
            operations?.failureCodes ?? [],
            operationsState,
            screen.operations.emptyTitle,
            screen.operations.emptyBody,
          )}
          {countTable(
            screen.operations.breakerOutcomes,
            screen.operations.breakerOutcomes,
            operations?.byBreakerOutcome ?? [],
            operationsState,
            screen.operations.emptyTitle,
            screen.operations.emptyBody,
          )}
          {countTable(
            screen.operations.signedOut,
            screen.operations.signedOut,
            operations?.signedOutAttempts ?? [],
            operationsState,
            screen.operations.emptyTitle,
            screen.operations.emptyBody,
          )}
          {countTable(
            screen.operations.routePaths,
            screen.operations.routePaths,
            operations?.byRoutePath ?? [],
            operationsState,
            screen.operations.emptyTitle,
            screen.operations.emptyBody,
          )}
        </div>

        {/*
          NOT A ZERO. The legacy path is declared and has no emitter, so the panel states
          the absence of a measurement rather than rendering a count nobody took.
        */}
        <p
          className="text-[11px] leading-relaxed text-adm-chip-warn-ink"
          data-field="admin-06.askLegacyRollback"
        >
          {screen.operations.legacyNotInstrumented}
        </p>
      </AdminPanel>

      <AdminPanel
        title={screen.improvement.title}
        field="admin-06.askImprovement"
        note={screen.improvement.purpose}
      >
        <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-2">
          {countTable(
            screen.improvement.unavailableByClass,
            screen.improvement.unavailableByClass,
            improvement?.unavailableByQuestionClass ?? [],
            improvementState,
            screen.improvement.emptyTitle,
            screen.improvement.emptyBody,
          )}
          {countTable(
            screen.improvement.missingRoles,
            screen.improvement.missingRoles,
            improvement?.missingEvidenceRoles ?? [],
            improvementState,
            screen.improvement.emptyTitle,
            screen.improvement.emptyBody,
          )}
          {countTable(
            screen.improvement.failureReasons,
            screen.improvement.failureReasons,
            improvement?.failureReasons ?? [],
            improvementState,
            screen.improvement.emptyTitle,
            screen.improvement.emptyBody,
          )}
          {countTable(
            screen.improvement.affectedClasses,
            screen.improvement.affectedClasses,
            improvement?.affectedQuestionClasses ?? [],
            improvementState,
            screen.improvement.emptyTitle,
            screen.improvement.emptyBody,
          )}
          {countTable(
            screen.improvement.affectedDomains,
            screen.improvement.affectedDomains,
            improvement?.affectedDomains ?? [],
            improvementState,
            screen.improvement.emptyTitle,
            screen.improvement.emptyBody,
          )}
          {countTable(
            screen.improvement.affectedCountries,
            screen.improvement.affectedCountries,
            improvement?.affectedCountries ?? [],
            improvementState,
            screen.improvement.emptyTitle,
            screen.improvement.emptyBody,
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-adm-ink-dim">
          {screen.improvement.poorOutcomeNote}
        </p>
        <p className="text-[11px] leading-relaxed text-adm-ink-dim">
          {screen.improvement.geographyNote}
        </p>
      </AdminPanel>

      <p className="text-[11px] leading-relaxed text-adm-ink-dim">{screen.sampleNote}</p>
      <p className="text-[11px] leading-relaxed text-adm-ink-dim">{screen.retentionNote}</p>
    </div>
  );
}

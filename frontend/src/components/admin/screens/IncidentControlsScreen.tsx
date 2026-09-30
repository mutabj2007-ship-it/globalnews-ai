'use client';

import { useCallback, useState } from 'react';
import { useAdminContext } from '../shell/AdminContext';
import { sectionState } from '@/lib/admin/adminDataState';
import { ADMIN_OPERATIONS_API } from '@/lib/admin/adminRoutes';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import { useAdminOperationsWrite } from '@/lib/admin/useAdminOperations';
import {
  ADMIN_OPERATIONS_REASON_MAX,
  ADMIN_OPERATIONS_REASON_MIN,
  type AdminOperationsChange,
  type AdminOperationsState,
  type AdminOperationsSwitch,
} from '@/lib/admin/adminOperationsTypes';
import { AdminDataTable, type AdminColumn } from '../primitives/AdminDataTable';
import { AdminPanel } from '../primitives/AdminPanel';
import { AdminStateBlock } from '../primitives/AdminStateBlock';
import { StatusChip, type ChipTone } from '../primitives/StatusChip';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN OPERATIONS R1 — INCIDENT CONTROLS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The first admin screen that changes something, so its whole design is about
 * not misleading the person operating it during an incident.
 *
 * FOUR RULES IT IS BUILT AROUND:
 *
 *   1. NOTHING IS OPTIMISTIC. A control renders the server's last confirmed
 *      reading. After a write, it renders the server's RE-READ of the stored
 *      row, not the value that was asked for. A 2xx is not evidence that a
 *      value changed, and this screen never treats it as such.
 *   2. EFFECTIVE AND REQUESTED ARE SHOWN SEPARATELY, always, even when they
 *      agree. Collapsing them into one chip would hide the only state an
 *      operator genuinely needs help with — the one where they disagree.
 *   3. "CANNOT CONFIRM" IS NOT "OK". An unreadable switch store is rendered
 *      with its own tone and its own sentence. A green OFF and an unknown OFF
 *      look nothing alike here.
 *   4. UNAVAILABLE WORK IS NOT DRAWN AS A CONTROL. Monitoring and delivery
 *      have no enforcement, so they appear as text under a heading that says
 *      so, with no switch, no button and nothing clickable.
 *
 * The capability split is deliberate: the screen is visible on `analytics.view`
 * so the roles most likely to notice a problem can see the state, and operable
 * only on `operations.control`. A reader who cannot operate sees real values and
 * a sentence saying why the buttons are absent — not a hidden screen, and not a
 * button that fails when pressed.
 */
export function IncidentControlsScreen(): JSX.Element {
  const { t, can } = useAdminContext();
  if (!can('analytics.view')) return <p>{t.access.forbiddenBody}</p>;
  return <IncidentControlsPanels />;
}

type Pending = { name: string; enabled: boolean } | null;

function IncidentControlsPanels(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.incidentControls;
  const resource = useAdminResource<AdminOperationsState>(ADMIN_OPERATIONS_API.state);
  const write = useAdminOperationsWrite();

  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);

  const data = resource.data;
  const state = sectionState(resource.state, data);

  const closeConfirm = useCallback(() => {
    setPending(null);
    setReason('');
    setReasonTouched(false);
  }, []);

  const apply = useCallback(async () => {
    if (!pending) return;
    const ok = await write.submit(pending.name, pending.enabled, reason.trim());
    closeConfirm();
    /* Re-read regardless of outcome: a refused write must not leave a stale view. */
    resource.reload();
    return ok;
  }, [pending, reason, write, closeConfirm, resource]);

  const environment = data?.environment ?? null;
  const mayOperate = data?.mayOperate === true;

  /* The compute switch is the primary control; everything else is advanced. */
  const primary = data?.switches.find((row) => row.labelKey === 'pauseNewAiAnswers') ?? null;
  const advanced = (data?.switches ?? []).filter((row) => row.labelKey !== 'pauseNewAiAnswers');

  const controlProps = {
    mayOperate,
    pending,
    reason,
    reasonTouched,
    writeState: write.state,
    lastResultName: write.result?.switch.name ?? null,
    lastResultApplied: write.result?.applied ?? null,
    onAsk: (name: string, enabled: boolean) => {
      write.reset();
      setPending({ name, enabled });
      setReason('');
      setReasonTouched(false);
    },
    onReason: (value: string) => {
      setReason(value);
      setReasonTouched(true);
    },
    onCancel: closeConfirm,
    onApply: apply,
  };

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <AdminStateBlock state={state} onRetry={resource.reload}>
        {data ? (
          <div className="flex flex-col gap-5">
            <EnvironmentBanner data={data} />

            <AdminPanel title={screen.title} field="operations.switchState">
              <p className="text-[13px] font-medium text-adm-ink">{healthLine(data, screen)}</p>
              <p className="text-[12px] text-adm-ink-4">{screen.health.savedReadable}</p>
              {!mayOperate ? <p className="text-[12px] text-adm-ink-4">{screen.readOnly}</p> : null}
            </AdminPanel>

            {/*
              ONE PRIMARY CONTROL. The compute switch is what an operator reaches for in
              almost every incident, so it is the only thing at this level. The R2 control
              is real and operable, but putting two near-identical controls side by side
              invites the wrong one to be pressed under pressure.
            */}
            {primary ? <SwitchControl row={primary} {...controlProps} /> : null}

            {/*
              ADVANCED — disclosed, not hidden. A <details> element is keyboard-operable
              and readable by assistive technology without any script, and the summary
              states what is inside before it is opened.
            */}
            {advanced.length > 0 ? (
              <details className="rounded-xl border border-adm-edge-soft bg-adm-card-soft">
                <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-adm-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent">
                  {screen.advanced.heading}
                </summary>
                <div className="flex flex-col gap-4 border-t border-adm-edge-soft p-4">
                  <p className="text-[12px] text-adm-ink-4">{screen.advanced.note}</p>
                  {advanced.map((row) => (
                    <SwitchControl key={row.name} row={row} {...controlProps} />
                  ))}
                </div>
              </details>
            ) : null}

            <HistoryPanel history={data.history} />

            <AdminPanel title={screen.notHere.heading} field="operations.notAvailable">
              <p className="text-[12px] text-adm-ink-4">{screen.notHere.monitoring}</p>
              <p className="text-[12px] text-adm-ink-4">{screen.notHere.providers}</p>
            </AdminPanel>
          </div>
        ) : null}
      </AdminStateBlock>

      {environment ? null : null}
    </div>
  );
}

/** The one thing on this screen that must never be guessed. */
function EnvironmentBanner({ data }: { data: AdminOperationsState }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.incidentControls;
  const env = data.environment;
  const label = env.confirmed
    ? screen.environment[env.environment]
    : screen.environment.unconfirmed;
  const tone: ChipTone = env.confirmed
    ? env.environment === 'PRODUCTION'
      ? 'bad'
      : 'warn'
    : 'mute';

  return (
    <AdminPanel title={screen.environment.label} field="operations.environment">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={tone} label={label} />
        <span className="text-[12px] text-adm-ink-4">
          {screen.state.checkedAt} {formatTime(data.checkedAt)}
        </span>
      </div>
      {!env.confirmed ? (
        <p className="text-[12px] text-adm-ink-3">
          {env.reason === 'NOT_SET'
            ? screen.environment.unconfirmedNotSet
            : screen.environment.unconfirmedNotRecognised}
        </p>
      ) : null}
      <p className="text-[11px] text-adm-ink-4">{screen.environment.nodeEnvNote}</p>
    </AdminPanel>
  );
}

function SwitchControl({
  row,
  mayOperate,
  pending,
  reason,
  reasonTouched,
  writeState,
  lastResultName,
  lastResultApplied,
  onAsk,
  onReason,
  onCancel,
  onApply,
}: {
  row: AdminOperationsSwitch;
  mayOperate: boolean;
  pending: Pending;
  reason: string;
  reasonTouched: boolean;
  writeState: string;
  lastResultName: string | null;
  lastResultApplied: boolean | null;
  onAsk: (name: string, enabled: boolean) => void;
  onReason: (value: string) => void;
  onCancel: () => void;
  onApply: () => void;
}): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.incidentControls;
  const copy = screen.controls[row.labelKey];
  const isPending = pending?.name === row.name;
  const blocked = row.blockedReason !== null;
  const operable = mayOperate && !blocked;
  /* `effective` is what the executor does. The action offered is its opposite. */
  const nextEnabled = !row.effective;
  const reasonTooShort = reason.trim().length < ADMIN_OPERATIONS_REASON_MIN;

  return (
    <AdminPanel title={copy.name} field="operations.switchState" note={copy.system}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip
          tone={row.effective ? 'good' : 'warn'}
          label={`${screen.state.effective} ${row.effective ? screen.state.on : screen.state.off}`}
        />
        <StatusChip
          tone="mute"
          label={`${screen.state.requested} ${
            row.requested === null
              ? screen.state.notSet
              : row.requested
                ? screen.state.on
                : screen.state.off
          }`}
        />
        <StatusChip
          tone="mute"
          label={`${screen.state.deployment} ${
            row.deploymentValueIsLiteralTrue ? screen.state.on : screen.state.off
          }`}
        />
        <StatusChip
          tone={row.readable ? 'info' : 'bad'}
          label={row.readable ? screen.state.readable : screen.state.unreadable}
        />
      </div>

      <p className="text-[12px] leading-relaxed text-adm-ink-3">{copy.consequence}</p>
      {'whenToUse' in copy && copy.whenToUse ? (
        <p className="text-[12px] leading-relaxed text-adm-ink-3">{copy.whenToUse}</p>
      ) : null}
      {'note' in copy && copy.note ? (
        <p className="text-[12px] leading-relaxed text-adm-ink-4">{copy.note}</p>
      ) : null}

      <p className="text-[11px] text-adm-ink-4">
        {screen.state.checkedAt} {formatTime(row.checkedAt)} · {screen.state.staleNote}
      </p>

      <p className="text-[11px] text-adm-ink-4">
        {row.lastChange
          ? `${screen.state.lastChange}: ${formatTime(row.lastChange.setAt)} ${screen.state.by} ${
              row.lastChange.setBy
            }${row.lastChange.reason ? ` — “${row.lastChange.reason}”` : ''}`
          : screen.state.noChange}
      </p>

      {blocked ? (
        <p className="text-[12px] text-adm-ink-3">{screen.blocked[row.blockedReason!]}</p>
      ) : null}

      {/*
        THE SERVER'S WORD ON THE LAST WRITE, AND ONLY WHAT IT ESTABLISHES.

        A 2xx plus a matching re-read establishes that the SETTING IS SAVED. It does not
        establish that every running instance is already enforcing it, and this block does
        not say that it does: "Setting saved", then what is still outstanding, then the
        propagation notice. Each instance refreshes on its own cache expiry, so a claim of
        universal completion would be a claim nothing here measured.
      */}
      {lastResultName === row.name && lastResultApplied !== null ? (
        <div className="flex flex-col gap-1 rounded-md border border-adm-edge-soft bg-adm-card p-3">
          <p className="text-[12px] font-semibold text-adm-ink">
            {lastResultApplied ? screen.result.saved : screen.result.notConfirmed}
          </p>
          {lastResultApplied ? (
            <p className="text-[12px] text-adm-ink-4">{screen.result.notUniversal}</p>
          ) : null}
          <p className="text-[12px] text-adm-ink-4">{screen.result.propagation}</p>
        </div>
      ) : null}
      {writeState === 'error' ? (
        <p className="text-[12px] text-adm-ink-3">{screen.result.failed}</p>
      ) : null}

      {operable && !isPending ? (
        <div>
          <button
            type="button"
            onClick={() => onAsk(row.name, nextEnabled)}
            className="rounded-lg border border-adm-edge bg-adm-card px-3 py-2 text-[12px] font-semibold text-adm-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent"
          >
            {row.effective ? copy.pause : copy.resume}
          </button>
        </div>
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-2 rounded-lg border border-adm-edge bg-adm-card p-3">
          <p className="text-[12px] font-semibold text-adm-ink">{screen.confirm.heading}</p>
          <p className="text-[12px] text-adm-ink-3">{copy.consequence}</p>
          <p className="text-[12px] text-adm-ink-4">{copy.reverse}</p>
          <label
            htmlFor={`reason-${row.name}`}
            className="text-[11px] font-semibold uppercase tracking-wide text-adm-ink-4"
          >
            {screen.confirm.reasonLabel}
          </label>
          <input
            id={`reason-${row.name}`}
            value={reason}
            maxLength={ADMIN_OPERATIONS_REASON_MAX}
            placeholder={screen.confirm.reasonPlaceholder}
            onChange={(event) => onReason(event.target.value)}
            className="rounded-md border border-adm-edge bg-adm-card-soft px-2 py-2 text-[12px] text-adm-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent"
          />
          {reasonTouched && reasonTooShort ? (
            <p className="text-[11px] text-adm-ink-3">{screen.confirm.reasonTooShort}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={reasonTooShort || writeState === 'pending'}
              onClick={onApply}
              className="rounded-lg border border-adm-edge bg-adm-card px-3 py-2 text-[12px] font-semibold text-adm-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent"
            >
              {writeState === 'pending' ? screen.confirm.pending : screen.confirm.submit}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-adm-edge-soft px-3 py-2 text-[12px] text-adm-ink-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent"
            >
              {screen.confirm.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </AdminPanel>
  );
}

function HistoryPanel({ history }: { history: AdminOperationsChange[] }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.incidentControls;
  const columns: AdminColumn<AdminOperationsChange>[] = [
    { id: 'setAt', header: screen.history.when, render: (row) => formatTime(row.setAt) },
    { id: 'name', header: screen.history.control, render: (row) => row.name },
    {
      id: 'enabled',
      header: screen.history.change,
      render: (row) => (row.enabled ? screen.state.on : screen.state.off),
    },
    { id: 'setBy', header: screen.history.who, render: (row) => row.setBy },
    { id: 'reason', header: screen.history.reason, render: (row) => row.reason ?? '—' },
  ];

  /*
    M-B — below 900px the five columns do not fit, and the table scrolled sideways
    with CHANGE, WHO and REASON out of view: the history was unattributable on the
    device an incident is most likely handled from. The shared table's
    `stackedOnNarrow` (Compact Lists) now renders each change below `adm-rail` as a
    row whose summary carries every non-secondary column — and none of these five is
    secondary, so WHEN, CONTROL, CHANGE, WHO and REASON all stay visible without
    opening it — with every field labelled inside. This replaces the screen-local
    stacked list that stood in until the shared rendering landed. Keep all five
    columns non-secondary: marking one secondary would hide it from the phone summary.
  */
  return (
    <AdminPanel title={screen.history.heading} field="operations.history">
      <AdminDataTable
        caption={screen.history.heading}
        columns={columns}
        rows={history}
        state={history.length === 0 ? 'zero' : 'real'}
        emptyTitle={screen.history.heading}
        emptyBody={screen.history.empty}
        rowKey={(row, index) => `${row.name}-${row.setAt}-${index}`}
        stackedOnNarrow
      />
    </AdminPanel>
  );
}

/** A plain-language verdict before any number, for someone opening this mid-incident. */
function healthLine(
  data: AdminOperationsState,
  screen: { health: Record<string, string> },
): string {
  const unreadable = data.switches.some((row) => !row.readable);
  if (unreadable) return screen.health.unknown;
  const compute = data.switches.find((row) => row.name === 'ASK_PUBLIC_COMPUTE_ENABLED');
  const r2 = data.switches.find((row) => row.name === 'ASK_R2_ENABLED');
  const computeOn = compute?.effective === true;
  const r2On = r2?.effective === true;
  if (computeOn && r2On) return screen.health.answering;
  if (!computeOn && !r2On) return screen.health.bothStopped;
  if (!computeOn) return screen.health.paused;
  return screen.health.r2Stopped;
}

function formatTime(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

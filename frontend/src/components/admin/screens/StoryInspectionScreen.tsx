'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_API, ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import { useAdminContext } from '../shell/AdminContext';
import { AdminPanel } from '../primitives/AdminPanel';
import { AdminStateBlock } from '../primitives/AdminStateBlock';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLIC VISUAL CONVERGENCE — Admin → News → Story inspection
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The operational truth behind what the public visual Home shows for a story, read through the
 * SAME canonical identities (PUBLIC-ENGINEERING-CONTRACT, baseline 647668c):
 *
 *   GET /admin/stories/by-article/:articleRef   articleRef → canonical story (Admin-guarded;
 *                                               available while STORY_BRIEF_ENABLED is OFF)
 *   GET /admin/stories/:storyId/brief           identity, derived Brief state, every immutable
 *                                               version (with sourceOperationId), every attempt
 *                                               (failure kind / code, operationId), the members
 *
 * Read-only and zero compute: no generation, no moderation, no write. The page is reached with
 * `?storyId=<uuid>` or `?articleRef=<64 hex>` — the `Inspect in Admin` control on `/visual` sends
 * whichever canonical id it holds — or by pasting one. The page (a thin Server Component) passes the
 * query in; every read goes through the sanctioned `useAdminResource` hook. Access is the existing
 * Admin boundary (AdminShell + `news.manage`); the backend guard stack is the security authority.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ARTICLE_REF = /^[0-9a-f]{64}$/;

interface StoryInspectionData {
  readonly story: { readonly storyId: string; readonly aliasIds: readonly string[]; readonly materialVersion: number };
  readonly currentEvidenceRevision: string;
  readonly state: string;
  readonly generationAvailable: boolean;
  readonly members: readonly { articleRef: string; articleUrl: string | null; sourceHost: string | null; storyId: string; addedAt: string }[];
  readonly versions: readonly {
    id: string;
    version: number;
    state: string;
    evidenceRevision: string;
    materialVersion: number;
    sourceOperationId: string | null;
    asOf: string;
    generatedAt: string;
  }[];
  readonly attempts: readonly {
    id: string;
    evidenceRevision: string;
    status: string;
    failureKind: string | null;
    failureCode: string | null;
    operationId: string | null;
    leaseExpiresAt: string;
    startedAt: string;
    finishedAt: string | null;
  }[];
}

export function StoryInspectionScreen({
  storyId,
  articleRef,
}: {
  readonly storyId: string | null;
  readonly articleRef: string | null;
}): JSX.Element {
  const { can, t } = useAdminContext();
  return can('news.manage') ? <StoryInspection storyId={storyId} articleRef={articleRef} /> : <p>{t.access.forbiddenBody}</p>;
}

function StoryInspection({ storyId, articleRef }: { readonly storyId: string | null; readonly articleRef: string | null }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.storyInspection;
  const router = useRouter();
  const [draft, setDraft] = useState(storyId ?? articleRef ?? '');
  const [invalidDraft, setInvalidDraft] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = draft.trim().toLowerCase();
    const next = new URLSearchParams();
    if (UUID.test(value)) next.set('storyId', value);
    else if (ARTICLE_REF.test(value)) next.set('articleRef', value);
    else {
      setInvalidDraft(true);
      return;
    }
    setInvalidDraft(false);
    router.replace(`${ADMIN_ROUTES.newsStories}?${next.toString()}`);
  };

  const validStory = storyId !== null && UUID.test(storyId);
  const validRef = storyId === null && articleRef !== null && ARTICLE_REF.test(articleRef);
  const invalidQuery = (storyId !== null && !validStory) || (storyId === null && articleRef !== null && !validRef);

  return (
    <div data-admin-story-inspection="" className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[18rem] flex-1 flex-col gap-1 text-[12px] text-adm-ink-4">
          {screen.lookupLabel}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="h-9 rounded-md border border-adm-edge-input bg-adm-card px-2 font-cd-mono text-[12px] text-adm-ink"
          />
          <span className="text-[11px]">{screen.lookupHint}</span>
        </label>
        <button type="submit" className="h-9 rounded-md border border-adm-edge px-3 text-[12px] font-semibold text-adm-ink hover:border-adm-edge-input">
          {screen.lookupAction}
        </button>
      </form>

      {(invalidDraft || invalidQuery) && (
        <p role="alert" className="text-[12px] text-adm-ink">
          {screen.invalidInput}
        </p>
      )}
      {!invalidQuery && storyId === null && articleRef === null && <p className="text-[12px] text-adm-ink-4">{screen.noSelection}</p>}
      {validStory && <Inspection storyId={storyId} />}
      {validRef && <ResolveThenInspect articleRef={articleRef} />}
    </div>
  );
}

/** articleRef → canonical story through the Admin-guarded resolver, then the same inspection. */
function ResolveThenInspect({ articleRef }: { readonly articleRef: string }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.storyInspection;
  const resolved = useAdminResource<{ story: { storyId: string } | null }>(`${ADMIN_API.stories}/by-article/${articleRef}`);
  if (resolved.state === 'real' && resolved.data !== null) {
    return resolved.data.story === null ? (
      <p role="status" className="text-[12px] text-adm-ink">
        {screen.noStory}
      </p>
    ) : (
      <Inspection storyId={resolved.data.story.storyId} />
    );
  }
  return (
    <AdminPanel title={screen.identityTitle} field="stories.identity" note={screen.identityNote}>
      <AdminStateBlock state={resolved.state} onRetry={resolved.reload} />
    </AdminPanel>
  );
}

function Inspection({ storyId }: { readonly storyId: string }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.storyInspection;
  const L = screen.labels;
  const inspection = useAdminResource<StoryInspectionData>(`${ADMIN_API.stories}/${storyId}/brief`);
  const data = inspection.data ?? undefined;
  const state = inspection.state;
  const retry = inspection.reload;
  const ts = (iso: string | null): string => (iso === null ? L.none : `${new Date(iso).toISOString().replace('T', ' ').slice(0, 19)}Z`);
  const listState = (rows: readonly unknown[] | undefined) => (state === 'real' && rows !== undefined && rows.length === 0 ? 'zero' : state);

  return (
    <div data-story-id={data?.story.storyId} className="flex flex-col gap-4">
      <AdminPanel title={screen.identityTitle} field="stories.identity" note={screen.identityNote}>
        <AdminStateBlock state={state} onRetry={retry}>
          {data && (
            <Rows
              rows={[
                [L.storyId, data.story.storyId],
                [L.aliasIds, data.story.aliasIds.join(', ')],
                [L.materialVersion, String(data.story.materialVersion)],
                [L.currentEvidenceRevision, data.currentEvidenceRevision],
              ]}
            />
          )}
        </AdminStateBlock>
      </AdminPanel>

      <AdminPanel title={screen.briefTitle} field="stories.briefState" note={screen.briefNote}>
        <AdminStateBlock state={state} onRetry={retry}>
          {data && (
            <Rows
              rows={[
                [L.state, data.state],
                [L.generationAvailable, data.generationAvailable ? L.yes : L.no],
              ]}
            />
          )}
        </AdminStateBlock>
      </AdminPanel>

      <AdminPanel title={screen.versionsTitle} field="stories.versions" note={screen.versionsNote}>
        <AdminStateBlock state={listState(data?.versions)} onRetry={retry}>
          {data &&
            (data.versions.length === 0 ? (
              <p className="text-[12px] text-adm-ink-4">{screen.emptyVersions}</p>
            ) : (
              <Table
                head={[L.version, L.state, L.evidenceRevision, L.materialVersion, L.sourceOperationId, L.generatedAt, L.asOf]}
                rows={data.versions.map((v) => [String(v.version), v.state, v.evidenceRevision, String(v.materialVersion), v.sourceOperationId ?? L.none, ts(v.generatedAt), ts(v.asOf)])}
              />
            ))}
        </AdminStateBlock>
      </AdminPanel>

      <AdminPanel title={screen.attemptsTitle} field="stories.attempts" note={screen.attemptsNote}>
        <AdminStateBlock state={listState(data?.attempts)} onRetry={retry}>
          {data &&
            (data.attempts.length === 0 ? (
              <p className="text-[12px] text-adm-ink-4">{screen.emptyAttempts}</p>
            ) : (
              <Table
                head={[L.status, L.failureKind, L.failureCode, L.operationId, L.evidenceRevision, L.startedAt, L.finishedAt, L.leaseExpiresAt]}
                rows={data.attempts.map((a) => [
                  a.status,
                  a.failureKind ?? L.none,
                  a.failureCode ?? L.none,
                  a.operationId ?? L.none,
                  a.evidenceRevision,
                  ts(a.startedAt),
                  ts(a.finishedAt),
                  ts(a.leaseExpiresAt),
                ])}
              />
            ))}
        </AdminStateBlock>
      </AdminPanel>

      <AdminPanel title={screen.membersTitle} field="stories.members" note={screen.membersNote}>
        <AdminStateBlock state={listState(data?.members)} onRetry={retry}>
          {data &&
            (data.members.length === 0 ? (
              <p className="text-[12px] text-adm-ink-4">{screen.emptyMembers}</p>
            ) : (
              <Table
                head={[L.articleRef, L.sourceHost, L.storyId, L.addedAt, L.articleUrl]}
                rows={data.members.map((m) => [m.articleRef, m.sourceHost ?? L.none, m.storyId, ts(m.addedAt), m.articleUrl ?? L.none])}
              />
            ))}
        </AdminStateBlock>
      </AdminPanel>
    </div>
  );
}

function Rows({ rows }: { readonly rows: readonly (readonly [string, string])[] }): JSX.Element {
  return (
    <dl className="grid grid-cols-[minmax(10rem,max-content)_1fr] gap-x-4 gap-y-1 text-[12px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-adm-ink-4">{label}</dt>
          <dd className="break-all font-cd-mono text-adm-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Table({ head, rows }: { readonly head: readonly string[]; readonly rows: readonly (readonly string[])[] }): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[12px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap border-b border-adm-edge px-2 py-1 font-semibold text-adm-ink-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-adm-edge-soft">
              {row.map((cell, j) => (
                <td key={j} className="break-all px-2 py-1 align-top font-cd-mono text-adm-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

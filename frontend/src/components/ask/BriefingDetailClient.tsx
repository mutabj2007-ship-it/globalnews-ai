'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  askV2Api,
  type AskV2BriefingDetail,
  type AskV2BriefingVersion,
  type AskV2Outcome,
} from '@/lib/api/askV2Api';
import { briefingStrings } from '@/lib/ask/briefingStrings';
import type { AskLocale } from '@/lib/ask/askStrings';
import { BriefingVersionView } from './BriefingViews';

/** A briefing id is a UUID (the server validates it too). */
const BRIEFING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * R2 · D1 — one briefing, one stored version. Two database reads (the briefing, then the chosen
 * or latest version); 0 AI, 0 provider, nothing re-searched. The only write is Delete, which is
 * confirmed first and leaves the page only after the server says it is gone.
 */
export function BriefingDetailClient({
  id,
  requestedVersion,
  locale,
}: {
  readonly id: string;
  readonly requestedVersion: number | null;
  readonly locale: AskLocale;
}): JSX.Element {
  const t = briefingStrings(locale);
  const router = useRouter();
  const [detail, setDetail] = useState<AskV2Outcome<AskV2BriefingDetail> | null>(null);
  const [version, setVersion] = useState<AskV2Outcome<AskV2BriefingVersion> | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    /* Not a briefing id: nothing to read (an empty id would address the list route). */
    if (!BRIEFING_ID.test(id)) {
      setDetail({ ok: false, reason: 'REFUSED', status: 404 });
      return;
    }
    void (async () => {
      const d = await askV2Api.briefing(id);
      if (cancelled) return;
      setDetail(d);
      if (!d.ok) return;
      const latest = d.value.versions[d.value.versions.length - 1]?.version;
      const wanted =
        requestedVersion !== null && d.value.versions.some((v) => v.version === requestedVersion)
          ? requestedVersion
          : latest;
      if (wanted === undefined) return;
      const v = await askV2Api.briefingVersion(id, wanted);
      if (!cancelled) setVersion(v);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, requestedVersion]);

  const remove = useCallback(async () => {
    if (deleting || !window.confirm(t.deleteConfirm)) return;
    setDeleting(true);
    const result = await askV2Api.deleteBriefing(id);
    setDeleting(false);
    if (result.ok) router.push('/saved');
  }, [deleting, id, router, t.deleteConfirm]);

  const failure =
    detail !== null && !detail.ok
      ? detail.reason === 'SIGNED_OUT'
        ? t.signedOut
        : detail.status === 404
          ? t.notFound
          : t.unavailable
      : null;

  return (
    <main data-briefing="surface" className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link href="/saved" className="text-[12.5px] text-signal hover:underline">
          ← {t.back}
        </Link>
        {failure !== null && (
          <p data-briefing="failure" className="text-[13.5px] text-ink-secondary">
            {failure}
          </p>
        )}
        {detail?.ok === true && version?.ok === true && (
          <>
            <BriefingVersionView
              detail={detail.value}
              version={version.value}
              locale={locale === 'pl' ? 'pl' : 'en'}
            />
            <div>
              <button
                type="button"
                data-briefing="delete"
                disabled={deleting}
                onClick={() => void remove()}
                className="rounded-[8px] border border-[#7a2b2b] px-3 py-2 text-[12.5px] font-semibold text-[#ff8a80] hover:bg-[#2a0f0f] disabled:opacity-60"
              >
                {t.delete}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

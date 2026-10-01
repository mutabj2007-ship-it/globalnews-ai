'use client';

import { useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { AskV2OperationContext } from '@/lib/api/askV2Api';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * HOME R1 · STAGE A — INSPECT: what the SERVER made of the context references.
 *
 * Renders `operation.context` exactly as returned — every reference with its status
 * (Used / Not available / Not applied) and the server's reason. Nothing here is decided by
 * the client: an unresolvable reference is SHOWN, never dropped, never inferred (FINAL spec
 * §4, CTO contract §6). The label is the server's (retained article title / registry country
 * name); a reference without one shows its kind only. A local toggle — no request.
 */
export function AskContextInspect({
  context,
  language,
}: {
  readonly context: AskV2OperationContext;
  readonly language: LanguageCode;
}): JSX.Element | null {
  const t = getDictionary(language).homeR1.dock;
  const [open, setOpen] = useState(false);
  if (context.refs.length === 0) return null;
  const used = context.refs.filter((r) => r.status === 'available').length;
  return (
    <section data-ask="context-inspect" data-ask-context-scope={context.scope} className="-mt-3 mb-6">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8fa6c0] hover:text-white"
      >
        <span>{t.using}</span>
        <span className="normal-case tracking-normal">
          {used}/{context.refs.length}
        </span>
        <span className="text-[#93cdf5] underline-offset-2 hover:underline">{open ? t.hideInspect : t.inspect}</span>
      </button>
      {open && (
        <div className="rounded-[10px] border border-[#1d4a73] bg-[#06223d] p-3">
          <ul className="flex flex-col gap-1.5">
            {context.refs.map((ref, i) => (
              <li
                key={`${ref.kind}-${ref.ref}-${i}`}
                data-ask-ref-status={ref.status}
                className="flex flex-wrap items-baseline gap-x-2 text-[13px] leading-[1.45] text-[#cfe2f2]"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#8fa6c0]">{t.kind[ref.kind]}</span>
                <span className="min-w-0 flex-1 truncate">{ref.label ?? (ref.kind === 'country' ? ref.ref : '—')}</span>
                <span
                  className={
                    ref.status === 'available'
                      ? 'font-semibold text-[#a8e0c6]'
                      : ref.status === 'unavailable'
                        ? 'font-semibold text-[#f3d36b]'
                        : 'font-semibold text-[#c5ccd6]'
                  }
                >
                  {t.status[ref.status]}
                  {ref.reason !== undefined && t.reasons[ref.reason] !== undefined ? ` · ${t.reasons[ref.reason]}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-[1.4] text-[#8fa6c0]">{t.refsNote}</p>
        </div>
      )}
    </section>
  );
}

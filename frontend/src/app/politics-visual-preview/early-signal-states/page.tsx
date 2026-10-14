import type { Metadata } from 'next';
import type { JSX } from 'react';
import { notFound } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PoliticsEsReadModelV1 } from '@globalnews-ai/shared';
import { requestedDisplayLocale } from '@/lib/i18n/displayLocale.server';
import type { PolLocale } from '@/lib/politics/politicsStrings';
import { EarlySignalModelView } from '@/components/politics/EarlySignalPanel';

/**
 * MASTER CTO R66 · #90 — DEVELOPMENT-ONLY state preview of the early-signal panel.
 *
 * "Demo fixtures strictly test/dev": under any production build (Alpha, Production) this route is
 * notFound() before anything is read, and the fixture file is NOT imported, so no synthetic data is in
 * any production bundle. Under `next dev` it reads the eight synthetic read models produced by the
 * Politics offline engine at e9b77ce (STATE_FIXTURES) and renders each one stamped as synthetic.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function EarlySignalStatesPreview(): Promise<JSX.Element> {
  if (process.env.NODE_ENV !== 'development') notFound();
  const locale = requestedDisplayLocale() as PolLocale;
  const raw = await readFile(join(process.cwd(), 'src/lib/politics/__fixtures__/es-states.v1.e9b77ce.json'), 'utf8');
  const states = JSON.parse(raw) as Record<string, PoliticsEsReadModelV1>;
  return (
    <main data-es="states-preview" className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-[24px] bg-sp-bg p-[16px] text-sp-ink">
      {Object.entries(states).map(([key, model]) => (
        <section key={key} data-es-fixture={key} className="flex flex-col gap-[8px]">
          <h2 className="font-gn-mono text-[11px] uppercase tracking-[0.14em] text-sp-ink-3">{key}</h2>
          <EarlySignalModelView locale={locale} model={model} preview />
        </section>
      ))}
    </main>
  );
}

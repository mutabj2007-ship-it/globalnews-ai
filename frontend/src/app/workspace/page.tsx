import Link from 'next/link';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';

type ModuleStatus = 'Foundation ready' | 'In development' | 'Planned';

interface CapabilityModule {
  symbol: string;
  name: string;
  description: string;
  status: ModuleStatus;
  href?: string;
}

const capabilityModules: CapabilityModule[] = [
  {
    symbol: '🌐',
    name: 'World Intelligence',
    description:
      'Connect major global developments across countries, regions, organizations, and markets.',
    status: 'In development',
  },
  {
    symbol: '🗺️',
    name: 'Country Intelligence',
    description:
      'Understand the current state of a country through events, evidence, categories, timelines, and coverage quality.',
    status: 'Foundation ready',
    href: '/map',
  },
  {
    symbol: '⚔️',
    name: 'Conflict Intelligence',
    description:
      'Track escalation, affected locations, involved actors, humanitarian consequences, negotiations, and uncertainty.',
    status: 'In development',
  },
  {
    symbol: '🗳️',
    name: 'Election Intelligence',
    description:
      'Compare turnout, counting progress, district activity, incidents, observers, results, and source agreement.',
    status: 'Planned',
  },
  {
    symbol: '📊',
    name: 'Economy Intelligence',
    description:
      'Explain inflation, trade, employment, public finance, growth, shortages, and economic policy.',
    status: 'Planned',
  },
  {
    symbol: '🛢️',
    name: 'Energy and Oil Intelligence',
    description:
      'Connect oil prices, fuel supply, production, shipping routes, OPEC decisions, sanctions, and geopolitical risk.',
    status: 'Planned',
  },
  {
    symbol: '💱',
    name: 'Currency and Market Intelligence',
    description:
      'Explain currency movements, market reactions, interest rates, commodities, and investor sentiment.',
    status: 'Planned',
  },
  {
    symbol: '⏱️',
    name: 'Timeline Intelligence',
    description:
      'Show what happened first, what changed, what followed, and the latest confirmed development.',
    status: 'In development',
  },
  {
    symbol: '🔭',
    name: 'Forecast and Watchlist Intelligence',
    description:
      'Identify monitored risks, possible next developments, indicators to watch, and changing conditions without presenting speculation as fact.',
    status: 'Planned',
  },
  {
    symbol: '🧾',
    name: 'Evidence and Source Comparison',
    description:
      'Show which sources agree, where they differ, what remains unconfirmed, and the evidence behind the briefing.',
    status: 'Foundation ready',
  },
  {
    symbol: '🔎',
    name: 'Research Intelligence',
    description:
      'Connect current developments with relevant history, science, technology, policy, and background knowledge.',
    status: 'In development',
    href: '/search',
  },
  {
    symbol: '🇷🇼',
    name: 'Rwanda Intelligence',
    description:
      'Support district comparison, elections, Imihigo performance, development projects, public services, budgets, infrastructure, and national trends.',
    status: 'Planned',
  },
];

const engineStatusLabels = [
  'Source-grounded',
  'Country-aware',
  'Relevance-ranked',
  'Duplicate-filtered',
  'Explainable',
];

const suggestedQuestions = [
  'What changed in Sudan today?',
  'Why are oil prices rising?',
  "Compare Rwanda's districts",
  'What is driving currency volatility?',
  'What are sources disagreeing about?',
];

const processSteps = [
  'Question or country selection',
  'Source collection',
  'Relevance and duplicate filtering',
  'Event and evidence analysis',
  'Summary, timeline, comparison, and sources',
];

const todaysIntelligencePlaceholders = [
  {
    title: 'Global developments',
    description:
      'Intelligence briefs on major global developments will appear here once the analysis pipeline is connected.',
  },
  {
    title: 'Country watch',
    description:
      'Country-level intelligence briefs will appear here once the analysis pipeline is connected.',
  },
  {
    title: 'Markets and energy',
    description:
      'Market and energy intelligence briefs will appear here once the analysis pipeline is connected.',
  },
];

const rwandaPreviewItems = [
  'District comparisons',
  'Imihigo performance',
  'Election intelligence',
  'Development projects',
  'Education and health indicators',
  'Infrastructure',
  'National and local trends',
];

function StatusBadge({ status }: { status: ModuleStatus }): JSX.Element {
  const label =
    status === 'Foundation ready'
      ? 'Status: Foundation ready'
      : status === 'In development'
        ? 'Status: In development'
        : 'Status: Planned';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200">
      <span aria-hidden="true">
        {status === 'Foundation ready' ? '●' : status === 'In development' ? '◐' : '○'}
      </span>
      {label}
    </span>
  );
}

function CapabilityCard({ module }: { module: CapabilityModule }): JSX.Element {
  const content = (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-6 transition-colors hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg"
        >
          {module.symbol}
        </span>
        <StatusBadge status={module.status} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-white">{module.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{module.description}</p>
      </div>
      {module.href ? (
        <span className="mt-auto text-sm font-medium text-sky-400">Open →</span>
      ) : null}
    </div>
  );

  if (module.href) {
    return (
      <Link
        href={module.href}
        className="block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        aria-label={`${module.name}: ${module.description}`}
      >
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}

export default function HomePage(): JSX.Element {
  return (
    <>
      <NavBar />
      <main className="bg-slate-950 text-slate-100">
        {/* 1. HERO — INTELLIGENCE WORKSPACE */}
        <section className="border-b border-white/10 px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
              GlobalNews AI
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-5xl">
              Understand the world, not just the headlines.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Ask about a country, conflict, election, economy, market, crisis, or developing event.
              GlobalNews AI will organize the evidence into summaries, timelines, comparisons,
              uncertainties, and sources.
            </p>

            <div className="mx-auto mt-10 flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
              <label htmlFor="intelligence-query" className="sr-only">
                Ask what is happening anywhere in the world
              </label>
              <input
                id="intelligence-query"
                name="intelligence-query"
                type="text"
                placeholder="Ask what is happening anywhere in the world..."
                className="w-full flex-1 rounded-lg border border-white/15 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
              <button
                type="button"
                className="rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Analyze
              </button>
            </div>

            <ul className="mx-auto mt-6 flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((question) => (
                <li key={question}>
                  <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                    {question}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 2. INTELLIGENCE ENGINE STATUS STRIP */}
        <section
          aria-label="Intelligence engine attributes"
          className="border-b border-white/10 bg-slate-900/40 px-6 py-4"
        >
          <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {engineStatusLabels.map((label) => (
              <li
                key={label}
                className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* 3. CAPABILITY-BASED INTELLIGENCE MODULES */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Intelligence modules</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Modules are the brain. The interface is the face. Each module is a capability the
                engine applies behind the scenes when you ask a question.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {capabilityModules.map((module) => (
                <CapabilityCard key={module.name} module={module} />
              ))}
            </div>
          </div>
        </section>

        {/* 4. HOW THE INTELLIGENCE ENGINE WORKS */}
        <section className="border-y border-white/10 bg-slate-900/40 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              How the intelligence engine works
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              Advanced intelligence functions are being progressively introduced. This is the
              pipeline each question moves through today and as capabilities mature.
            </p>

            <ol className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              {processSteps.map((step, index) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-300"
                    >
                      {index + 1}
                    </span>
                    {step}
                  </span>
                  {index < processSteps.length - 1 ? (
                    <span aria-hidden="true" className="hidden text-slate-600 sm:inline">
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. TODAY'S INTELLIGENCE PLACEHOLDER */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Today&apos;s Intelligence</h2>
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {todaysIntelligencePlaceholders.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/10 bg-slate-900/60 p-6"
                >
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. RWANDA INTELLIGENCE PREVIEW */}
        <section className="border-t border-white/10 bg-slate-900/40 px-6 py-20">
          <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-slate-950/60 p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Rwanda Intelligence preview
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              Rwanda Intelligence is planned. It will eventually provide:
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {rwandaPreviewItems.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-slate-500">
              District and Imihigo data are not yet available.
            </p>
            <Link
              href="/map"
              className="mt-6 inline-block rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Explore country coverage
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

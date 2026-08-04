import { processSteps } from '@/lib/homeContent';

export function HowItWorks(): JSX.Element {
  return (
    <section
      className="border-b border-border bg-surface/40"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-12 flex flex-col gap-2 sm:mb-16">
          <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
            How it works
          </span>
          <h2
            id="how-it-works-heading"
            className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
          >
            From question to clarity, in three steps
          </h2>
        </div>

        <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {/* Connecting line for larger screens, purely decorative */}
          <div
            className="absolute left-0 right-0 top-6 hidden h-px bg-border sm:block"
            aria-hidden="true"
          />

          {processSteps.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="relative flex flex-col items-start gap-4">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-border-strong bg-void text-signal-bright">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div>
                  <div className="mb-1 font-mono text-xs text-ink-tertiary">{item.step}</div>
                  <h3 className="mb-2 font-display text-lg font-medium text-ink-primary">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-secondary">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

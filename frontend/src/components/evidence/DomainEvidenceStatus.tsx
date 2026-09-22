import type { ReactNode } from 'react';
import {
  HUMANITARIAN_PUBLIC_READ_BLOCKERS,
  SECURITY_PUBLIC_CONTENT_BLOCKER,
  parseHumanitarianRetainedRead,
  type HumanitarianRetainedRead,
} from '@globalnews-ai/shared';
import { ReturnControl } from '@/components/navigation/ReturnControl';

type Props = {
  locale: string;
  children: ReactNode;
} & ({ domain: 'humanitarian'; retainedRead: HumanitarianRetainedRead } | { domain: 'security' });

const copy = {
  en: {
    status: 'Evidence & coverage',
    framework: 'Explore the assessment framework',
    frameworkNote:
      'Reference structure only. These panels contain no admitted assessments. Some framework labels are available in English only.',
    related: 'Related reporting is context only',
    context:
      'News articles do not establish a domain observation, incident, actor, cause, attribution, severity or change in need.',
    gates: 'What is needed to publish evidence',
    limits: 'What this view can tell you',
    hum: 'Humanitarian',
    sec: 'Security',
    humTitle: 'Need and access changes cannot yet be established',
    humSummary:
      'The current public reader has no admitted humanitarian observations. This does not mean there is no need or that access is open.',
    gapTitle: 'The evidence read is unavailable',
    gapSummary:
      'Coverage cannot be checked right now. No conclusion about need, access or change can be drawn from this failed read.',
    secTitle: 'Public Security evidence awaits governed approval',
    secSummary:
      'The public-content review gate is closed. This view cannot establish which incidents are confirmed, where they occurred or who is responsible. It is not an all-clear.',
    humLimits:
      'No assessed geography, precision, sector, observation time, source revision or freshness is available. No composite need or severity score is calculated.',
    secLimits:
      'Occurrence, actor, cause, attribution and severity require separate evidence. Missing fields remain unknown; a source claim alone does not confirm attribution. Coverage and confidence have not been established.',
    capture:
      'A retained publisher artifact with reviewed rights, provenance, observation time and source revision is required. Copernicus inundation geometry alone does not establish population need or access conditions.',
    protection:
      'Current geography and sensitive-location protection approval must permit display at the stated precision.',
    reader:
      'A governed reader must expose only admitted observations with source, revision, freshness and coverage limitations. The current reader accepts absence states only.',
    security:
      'Public-content and person-claim review, plus independent public-assessment approval, are required before any retained content, source name or URL can be displayed.',
    securityRead:
      'No record-level review result or retained-content count is disclosed here. This is the release gate, not an assessment of any country.',
    readFailure:
      'The backend response could not be validated or reached. The release requirements below still apply; this failure is not evidence that no observations exist.',
    blocked: 'Evidence gate closed',
    unavailable: 'Read unavailable',
  },
  pl: {
    status: 'Dowody i zakres pokrycia',
    framework: 'Zobacz strukturę oceny',
    frameworkNote:
      'Wyłącznie struktura referencyjna. Panele nie zawierają dopuszczonych ocen. Część etykiet tej struktury jest dostępna tylko po angielsku.',
    related: 'Powiązane doniesienia służą wyłącznie jako kontekst',
    context:
      'Artykuły prasowe nie stanowią obserwacji dziedzinowej ani dowodu zdarzenia, sprawcy, przyczyny, przypisania odpowiedzialności, dotkliwości lub zmiany potrzeb.',
    gates: 'Co jest wymagane do publikacji dowodów',
    limits: 'Co można ustalić w tym widoku',
    hum: 'Sytuacja humanitarna',
    sec: 'Bezpieczeństwo',
    humTitle: 'Nie można jeszcze ustalić zmian potrzeb i dostępu',
    humSummary:
      'Obecny publiczny odczyt nie zawiera dopuszczonych obserwacji humanitarnych. Nie oznacza to braku potrzeb ani otwartego dostępu.',
    gapTitle: 'Odczyt dowodów jest niedostępny',
    gapSummary:
      'Nie można teraz sprawdzić pokrycia. Nieudany odczyt nie pozwala wnioskować o potrzebach, dostępie ani zmianach.',
    secTitle: 'Publiczne dowody dotyczące bezpieczeństwa oczekują na zatwierdzenie',
    secSummary:
      'Warunek przeglądu treści publicznych nie został spełniony. Ten widok nie pozwala ustalić, które zdarzenia potwierdzono, gdzie wystąpiły ani kto za nie odpowiada. Nie oznacza to braku zagrożeń.',
    humLimits:
      'Brak ocenionego obszaru, dokładności lokalizacji, sektora, czasu obserwacji, rewizji źródła i informacji o aktualności. Nie obliczamy zbiorczego wskaźnika potrzeb ani dotkliwości.',
    secLimits:
      'Wystąpienie zdarzenia, podmiot, przyczyna, przypisanie odpowiedzialności i dotkliwość wymagają odrębnych dowodów. Brakujące dane pozostają nieznane; twierdzenie źródła samo nie potwierdza odpowiedzialności. Zakres pokrycia i pewność nie zostały ustalone.',
    capture:
      'Wymagany jest zachowany materiał wydawcy ze sprawdzonymi prawami, pochodzeniem, czasem obserwacji i rewizją źródła. Sama geometria zalania z Copernicus nie określa potrzeb ludności ani warunków dostępu.',
    protection:
      'Aktualne zatwierdzenie geografii i ochrony wrażliwych lokalizacji musi zezwalać na wyświetlanie z podaną dokładnością.',
    reader:
      'Zatwierdzony odczyt musi udostępniać tylko dopuszczone obserwacje wraz ze źródłem, rewizją, aktualnością i ograniczeniami pokrycia. Obecny odczyt akceptuje wyłącznie stany braku oceny.',
    security:
      'Przegląd treści publicznych i twierdzeń dotyczących osób oraz niezależna zgoda na publiczną ocenę są wymagane przed ujawnieniem zachowanej treści, nazwy źródła lub adresu URL.',
    securityRead:
      'Nie ujawniamy wyników przeglądu poszczególnych rekordów ani liczby zachowanych treści. To warunek publikacji, a nie ocena jakiegokolwiek kraju.',
    readFailure:
      'Nie udało się połączyć z usługą odczytu lub zweryfikować jej odpowiedzi. Poniższe wymagania nadal obowiązują; ten błąd nie dowodzi braku obserwacji.',
    blocked: 'Publikacja dowodów zablokowana',
    unavailable: 'Odczyt niedostępny',
  },
} as const;

/** Passive release status. Never accepts a raw artifact or a Security candidate. */
export function DomainEvidenceStatus(props: Props) {
  const t = copy[props.locale === 'pl' ? 'pl' : 'en'];
  const hum = props.domain === 'humanitarian';
  // Revalidate at the display seam; malformed/future success payloads never become evidence.
  const gap =
    props.domain === 'humanitarian' &&
    parseHumanitarianRetainedRead(props.retainedRead)?.absence !== 'NOT_ASSESSED';
  const humanitarianGateText = {
    REVIEWED_CAPTURE_REQUIRED: t.capture,
    CURRENT_PROTECTION_AUTHORITY_REQUIRED: t.protection,
    PUBLIC_OBSERVATION_READER_REQUIRED: t.reader,
  } satisfies Record<(typeof HUMANITARIAN_PUBLIC_READ_BLOCKERS)[number], string>;
  const gates = hum
    ? HUMANITARIAN_PUBLIC_READ_BLOCKERS.map((code) => ({
        code,
        text: humanitarianGateText[code],
      }))
    : [{ code: SECURITY_PUBLIC_CONTENT_BLOCKER, text: t.security }];
  return (
    <div
      data-evidence-domain={props.domain}
      data-evidence-status={gap ? 'READ_UNAVAILABLE' : 'GATE_CLOSED'}
      className="min-h-screen bg-sp-bg text-sp-ink"
    >
      <section
        aria-labelledby={`${props.domain}-evidence-title`}
        className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12"
      >
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-sp-line pb-5">
          <div className="flex items-center gap-4">
            <ReturnControl language={props.locale} variant="microline" />
            <span className="text-sm font-semibold">{hum ? t.hum : t.sec}</span>
          </div>
          <span className="text-xs uppercase tracking-widest text-sp-ink-2">{t.status}</span>
        </header>
        <span className="inline-block rounded border border-sp-line bg-sp-panel px-3 py-2 text-sm text-sp-ink-2">
          {gap ? t.unavailable : t.blocked}
        </span>
        <h1
          id={`${props.domain}-evidence-title`}
          className="mt-5 max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl"
        >
          {hum ? (gap ? t.gapTitle : t.humTitle) : t.secTitle}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-sp-ink-2">
          {hum ? (gap ? t.gapSummary : t.humSummary) : t.secSummary}
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="min-w-0 rounded border border-sp-line bg-sp-panel p-5">
            <h2 className="text-base font-semibold">{t.gates}</h2>
            <ul className="mt-4 space-y-4 text-sm leading-relaxed text-sp-ink-2">
              {gates.map((gate) => (
                <li key={gate.code} data-evidence-gate={gate.code}>
                  {gate.text}
                </li>
              ))}
            </ul>
          </section>
          <section className="min-w-0 rounded border border-sp-line bg-sp-panel p-5">
            <h2 className="text-base font-semibold">{t.limits}</h2>
            <p className="mt-4 text-sm leading-relaxed text-sp-ink-2">
              {hum ? t.humLimits : t.secLimits}
            </p>
            {(!hum || gap) && (
              <p className="mt-4 text-sm leading-relaxed text-sp-ink-2">
                {gap ? t.readFailure : t.securityRead}
              </p>
            )}
          </section>
        </div>
        <aside className="mt-6 border-l-2 border-sp-line pl-4">
          <h2 className="text-sm font-semibold">{t.related}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-sp-ink-2">{t.context}</p>
        </aside>
        <details data-evidence-framework className="mt-8 rounded border border-sp-line">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2">
            {t.framework}
          </summary>
          <p className="border-t border-sp-line p-4 text-sm leading-relaxed text-sp-ink-2">
            {t.frameworkNote}
          </p>
          <div className="max-w-full overflow-x-auto">{props.children}</div>
        </details>
      </section>
    </div>
  );
}

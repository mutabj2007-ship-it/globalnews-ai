import type { LanguageCode, SourceDiversity } from '@globalnews-ai/shared';

interface SourceDiversitySummaryProps {
  sourceDiversity?: SourceDiversity;
  isMock: boolean;
  /** Milestone #47 — defaults to 'en', so every pre-M47 caller renders exactly as before. */
  language?: LanguageCode;
}

interface SourceDiversityText {
  primary: string;
  detail: string[];
}

function pluralEn(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * Milestone #47 — small, deterministic Polish numeral-form selector.
 * Standard, well-known Polish grammar rule (not an NLP engine, not
 * stemming): singular for 1; "few" form for count ending in 2-4
 * (excluding the 12-14 teens exception); "many" (genitive plural) form
 * otherwise. forms = [singular, few, many].
 */
function polishForm(count: number, forms: [string, string, string]): string {
  const [one, few, many] = forms;
  if (count === 1) return one;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

function pluralPl(count: number, forms: [string, string, string]): string {
  return `${count} ${polishForm(count, forms)}`;
}

/**
 * Milestone #44 — pure text-selection logic, isolated from JSX for
 * testability. NEVER uses "independent", "verified", or any wording
 * implying editorial independence — sourceDiversity (Milestone #43) is
 * structural metadata only, and this function's entire vocabulary is
 * built from bounded, structural terms (retrieved/cluster/domain/source
 * name) to match that. Milestone #47 preserves this discipline in
 * Polish exactly (e.g. "niezależn-" / "independent" is never used).
 *
 * MOCK CASE: sourceDiversity can describe mock fixture structure, but
 * that is never genuine real-world evidence breadth. When isMock is
 * true, the summary is explicitly demo-qualified and detail metrics are
 * omitted entirely (the CTO-approved "alternatively simplify" option) —
 * a single clearly-labeled demo line is less noisy than a full detail
 * section built from meaningless mock counts.
 *
 * Milestone #47 — `language` defaults to 'en'; English output (both the
 * exact strings and the pluralization rule) is byte-for-byte unchanged
 * from before this milestone. No M43 semantics change — this function
 * only selects presentation strings for already-computed SourceDiversity
 * counts.
 */
export function resolveSourceDiversityText(
  sourceDiversity: SourceDiversity | undefined,
  isMock: boolean,
  language: LanguageCode = 'en',
): SourceDiversityText | undefined {
  if (!sourceDiversity) return undefined;

  if (language === 'pl') {
    if (isMock) {
      return {
        primary: `Dane demonstracyjne: ${pluralPl(sourceDiversity.retrievedArticleCount, ['pobrany artykuł', 'pobrane artykuły', 'pobranych artykułów'])}, ${pluralPl(sourceDiversity.reportingClusterCount, ['grupa doniesień', 'grupy doniesień', 'grup doniesień'])}`,
        detail: [],
      };
    }

    const primary = `${pluralPl(sourceDiversity.retrievedArticleCount, ['pobrany artykuł', 'pobrane artykuły', 'pobranych artykułów'])} · ${pluralPl(sourceDiversity.reportingClusterCount, ['grupa doniesień', 'grupy doniesień', 'grup doniesień'])}`;

    const detail: string[] = [
      pluralPl(sourceDiversity.duplicateLikeClusterCount, ['grupa podobnych doniesień', 'grupy podobnych doniesień', 'grup podobnych doniesień']),
      `Największa grupa: ${pluralPl(sourceDiversity.largestClusterSize, ['artykuł', 'artykuły', 'artykułów'])}`,
      pluralPl(sourceDiversity.knownDomainCount, ['znana domena', 'znane domeny', 'znanych domen']),
      ...(sourceDiversity.unknownDomainArticleCount > 0
        ? [`${pluralPl(sourceDiversity.unknownDomainArticleCount, ['artykuł', 'artykuły', 'artykułów'])} z nierozpoznanym adresem URL`]
        : []),
      pluralPl(sourceDiversity.distinctSourceNameCount, ['odrębna nazwa źródła', 'odrębne nazwy źródeł', 'odrębnych nazw źródeł']),
    ];

    return { primary, detail };
  }

  if (isMock) {
    return {
      primary: `Demo data: ${pluralEn(sourceDiversity.retrievedArticleCount, 'retrieved article')}, ${pluralEn(sourceDiversity.reportingClusterCount, 'reporting cluster')}`,
      detail: [],
    };
  }

  const primary = `${pluralEn(sourceDiversity.retrievedArticleCount, 'retrieved article')} · ${pluralEn(sourceDiversity.reportingClusterCount, 'reporting cluster')}`;

  const detail: string[] = [
    pluralEn(sourceDiversity.duplicateLikeClusterCount, 'duplicate-like cluster'),
    `Largest cluster: ${pluralEn(sourceDiversity.largestClusterSize, 'article')}`,
    pluralEn(sourceDiversity.knownDomainCount, 'known domain'),
    ...(sourceDiversity.unknownDomainArticleCount > 0
      ? [`${pluralEn(sourceDiversity.unknownDomainArticleCount, 'article')} with unrecognized URLs`]
      : []),
    pluralEn(sourceDiversity.distinctSourceNameCount, 'distinct source name'),
  ];

  return { primary, detail };
}

const RETRIEVAL_DETAIL_LABEL: Record<LanguageCode, string> = {
  en: 'Retrieval detail', pl: 'Szczegóły pobierania', sw: 'Retrieval detail', fr: 'Retrieval detail', es: 'Retrieval detail', ar: 'Retrieval detail', rw: 'Retrieval detail',
};

/**
 * Milestone #44 — renders M43's structural retrieval metadata without
 * claiming editorial independence. Renders nothing when sourceDiversity
 * is absent (per the approved contract — never fabricated).
 */
export function SourceDiversitySummary({
  sourceDiversity,
  isMock,
  language = 'en',
}: SourceDiversitySummaryProps): JSX.Element | null {
  const text = resolveSourceDiversityText(sourceDiversity, isMock, language);
  if (!text) return null;

  return (
    <div className="mt-3 flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
        {text.primary}
      </span>

      {text.detail.length > 0 && (
        <details>
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
            {RETRIEVAL_DETAIL_LABEL[language] ?? RETRIEVAL_DETAIL_LABEL.en}
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {text.detail.map((line) => (
              <li key={line} className="text-[11px] text-ink-tertiary">
                {line}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

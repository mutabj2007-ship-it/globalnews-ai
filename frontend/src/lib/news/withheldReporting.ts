/*
  R135-V1 (E1 R135 addendum 02 §4) — the reader line for reporting the server found but WITHHELD
  because its sources are not cleared. NOT a service failure: it must never say "a service problem".

  These seven values are Claude L's qualified `homeEmpty.withheld` strings (L_R118_CHANGES,
  2026-10-16), copied byte-for-byte from `frontend/src/lib/news/sourceStatus.ts` at b7309c3 on the
  BE-1 FE line, which this release line does not carry. When that line is integrated, this module
  is replaced by `sourceStatusStrings(locale).homeEmpty.withheld`. Do not edit a value here: a
  change is a new L round.
*/
const WITHHELD: Readonly<Record<string, string>> = {
  en: 'Reporting was found, but its sources are not cleared for display here.',
  pl: 'Znaleziono doniesienia, ale ich źródła nie są tu dopuszczone do wyświetlania.',
  fr: 'Des reportages ont été trouvés, mais leurs sources ne sont pas autorisées à l’affichage ici.',
  de: 'Es wurden Berichte gefunden, ihre Quellen sind hier jedoch nicht zur Anzeige freigegeben.',
  es: 'Se encontraron reportes, pero sus fuentes no están autorizadas para mostrarse aquí.',
  pt: 'Foram encontradas reportagens, mas suas fontes não estão autorizadas para exibição aqui.',
  ar: 'عُثر على تقارير، لكن مصادرها غير مُجازة للعرض هنا.',
};

/** The withheld-reporting line in the reader's language (English when the locale has no L value). */
export function withheldReportingLine(locale: string | undefined): string {
  return WITHHELD[locale ?? 'en'] ?? WITHHELD.en;
}

/**
 * True only when the response itself says reader-rights withholding removed articles
 * (`sourceRightsWithheld`, appended by the backend reader-rights interceptor). Absent or malformed
 * means "not stated" — the caller keeps its existing unavailable wording.
 */
export function rightsWithheldStated(response: unknown): boolean {
  if (response === null || typeof response !== 'object') return false;
  const w = (response as { sourceRightsWithheld?: unknown }).sourceRightsWithheld;
  if (w === null || typeof w !== 'object') return false;
  const count = (w as { count?: unknown }).count;
  return typeof count === 'number' && count > 0;
}

import { createHash } from 'node:crypto';
import { isEnergyObservation, type EnergyReadResult } from '@globalnews-ai/shared';
import { ENERGY_GOVERNED_FRAME } from './energyGoverned';
import type { EnergyFrameData, EnergySubject } from './energyModel';
import { energyStrings, type EnergyLocale, type EnergyStrings } from './energyStrings';

/** Plan B: facts enter existing detail slots, never assessment or geometry slots. */
export function energyFrameFromRetained(read: EnergyReadResult, locale: EnergyLocale): EnergyFrameData {
  if (read.kind !== 'OBSERVATIONS') return ENERGY_GOVERNED_FRAME;
  const pl = locale === 'pl';
  const labels = pl
    ? ['Obserwacja', 'Miara', 'Okres', 'Wartość', 'Status publikacji', 'Zmiana u wydawcy', 'Geografia', 'Precyzja', 'Źródło', 'Pobrano', 'Identyfikator pobrania', 'Rola dowodu', 'Identyfikator podmiotu', 'Aktualność']
    : ['Observation', 'Metric', 'Period', 'Value', 'Release status', 'Publisher changed', 'Geography', 'Precision', 'Source', 'Retrieved', 'Retrieval identity', 'Evidence role', 'Subject identity', 'Freshness'];
  const metric = pl
    ? { GENERATION: 'Wytwarzanie', CAPACITY: 'Moc', STORAGE: 'Magazynowanie', OUTAGE: 'Wyłączenie', FLOW: 'Przepływ', GRID: 'Sieć', ASSET: 'Obiekt' }
    : { GENERATION: 'Generation', CAPACITY: 'Capacity', STORAGE: 'Storage', OUTAGE: 'Outage', FLOW: 'Flow', GRID: 'Grid', ASSET: 'Asset' };
  const status = pl
    ? { PRELIMINARY: 'Wstępny', REVISED: 'Zrewidowany', FINAL: 'Ostateczny', WITHDRAWN: 'Wycofany' }
    : { PRELIMINARY: 'Preliminary', REVISED: 'Revised', FINAL: 'Final', WITHDRAWN: 'Withdrawn' };
  const freshness = pl ? 'Zachowany dowód; najnowsza publikacja niezweryfikowana.' : 'Retained evidence; latest publisher edition unverified.';
  const groups = new Map<string, typeof read.observations>();
  for (const o of read.observations) {
    if (!isEnergyObservation(o) || o.releaseStatus === 'WITHDRAWN') continue;
    groups.set(o.subjectId, [...(groups.get(o.subjectId) ?? []), o]);
  }
  const subjects: EnergySubject[] = [];
  const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  for (const [id, observations] of [...groups].sort(([a], [b]) => lexical(a, b))) {
    const first = observations[0];
    // Conflicting identity must not silently select a name, type, or geography.
    if (observations.some(o => o.subjectName !== first.subjectName || o.subjectType !== first.subjectType || o.geographyId !== first.geographyId)) continue;
    observations.sort((a, b) => lexical(a.observationKey, b.observationKey));
    // URL identity is an opaque transport key, never a geographic or assessment inference.
    const routeId = 'e-' + createHash('sha256').update(id).digest('hex').slice(0, 62);
    subjects.push({
      id: routeId, name: first.subjectName, type: first.subjectType, scopeLabel: first.geographyId,
      corridorRole: null, assetRole: null, readerState: 'COVERAGE_GAP', canonicalAbsence: null,
      changeState: null, tone: 'achromatic', geometry: null, geometryWithheldBy: null,
      dataTier: 'PUBLIC', artifactsReviewed: 0, lastChecked: null, nextCheck: null,
      brief: null, headline: null, assessment: null, uncertainty: null, confidence: null, revisions: null,
      affectedSystems: [], timeline: [], crossDomain: [], watched: null,
      fields: observations.flatMap(o => {
        const values = [o.observationKey, metric[o.metric], o.period,
          `${o.value === null ? '—' : o.value} ${o.unit}`, status[o.releaseStatus],
          o.publisherChangedAt ?? '—', o.geographyId, o.spatialPrecision,
          `${o.provenance.institution} · ${o.provenance.providerId}`, o.provenance.retrievedAt!, o.retrievalId,
          o.provenance.evidenceRole!, o.subjectId, freshness];
        return values.map((value, i) => ({ id: `${o.observationKey}:${i}`, key: labels[i], value }));
      }),
      evidence: observations.map(o => ({
        id: o.observationKey, sourceClass: null, role: 'CONTEXT', language: '—',
        title: `${o.provenance.institution} · ${metric[o.metric]} · ${o.period} · ${o.value === null ? '—' : o.value} ${o.unit} · ${status[o.releaseStatus]} · ${labels[6]}: ${o.geographyId} · ${labels[7]}: ${o.spatialPrecision} · ${labels[5]}: ${o.publisherChangedAt ?? '—'} · ${labels[9]}: ${o.provenance.retrievedAt} · ${o.provenance.providerId} · ${o.provenance.evidenceRole} · ${labels[10]}: ${o.retrievalId} · ${labels[12]}: ${o.subjectId} · ${freshness}`,
        observedAt: null, disclosure: { rights: 'RIGHTS_ALLOWED', exposure: 'EXPOSURE_ALLOWED' },
      })),
    });
  }
  if (!subjects.length) return ENERGY_GOVERNED_FRAME;
  return { ...ENERGY_GOVERNED_FRAME, subjects, watchCount: null };
}

/** Existing banner copy slots distinguish held records from an unavailable read. */
export function energyRetainedStrings(read: EnergyReadResult, locale: EnergyLocale): EnergyStrings {
  const strings = energyStrings(locale);
  if (read.kind === 'EMPTY') return strings;
  const pl = locale === 'pl';
  return { ...strings,
    governedBanner: read.kind === 'UNAVAILABLE'
      ? (pl ? 'ODCZYT NIEDOSTĘPNY' : 'READ UNAVAILABLE')
      : (pl ? 'ZACHOWANE DOWODY' : 'RETAINED EVIDENCE'),
    governedBannerBody: read.kind === 'UNAVAILABLE'
      ? (pl ? 'Nie można sprawdzić zachowanych danych. Brak odczytu nie oznacza braku zdarzeń.' : 'Retained holdings could not be checked. An unavailable read does not mean no events occurred.')
      : (pl ? 'Zachowane obserwacje; nieobsługiwane oceny i geometria pozostają nieobecne.' : 'Retained observations; unsupported assessments and geometry remain absent.'),
  };
}

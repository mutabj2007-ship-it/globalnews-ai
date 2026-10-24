import { canonicalLeadUrl } from './lead-url-guard';
import { GDELT_ATTRIBUTION, type GdeltLead } from './gdelt-lead.types';

/*
  Spec §2 / E1 C-G4 — each lead is CONSTRUCTED from the five named fields. The raw record is never
  spread and `title`, `socialimage`, `url_mobile` or any unknown field is never read, so none of
  them can pass. A record without a canonical https URL, a domain or a parseable seendate is dropped
  whole (fail closed); it is never repaired.
*/
export function parseGdeltLeads(raw: unknown): GdeltLead[] {
  const articles =
    raw !== null &&
    typeof raw === 'object' &&
    Array.isArray((raw as { articles?: unknown }).articles)
      ? (raw as { articles: unknown[] }).articles
      : [];
  const leads: GdeltLead[] = [];
  for (const item of articles) {
    if (item === null || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const url = canonicalLeadUrl(stringField(record, 'url'));
    const domain = stringField(record, 'domain')?.toLowerCase() ?? null;
    const observedAt = observationDate(stringField(record, 'seendate'));
    if (url === null || domain === null || observedAt === null) continue;
    leads.push(
      Object.freeze({
        url,
        domain,
        observedAt,
        language: stringField(record, 'language'),
        providerCountry: stringField(record, 'sourcecountry'),
        attribution: GDELT_ATTRIBUTION,
      }),
    );
  }
  return leads;
}

function stringField(
  record: Record<string, unknown>,
  key: 'url' | 'domain' | 'seendate' | 'language' | 'sourcecountry',
): string | null {
  const value = record[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * GDELT's compact UTC form "20261024T074500Z" → ISO. Explicit parse with a round-trip guard (the
 * same rule as `gdelt-doc.provider.ts`): month 13 or day 32 is null, never rolled over.
 */
function observationDate(seendate: string | null): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate ?? '');
  if (match === null) return null;
  const [, year, month, day, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString() === iso ? iso : null;
}

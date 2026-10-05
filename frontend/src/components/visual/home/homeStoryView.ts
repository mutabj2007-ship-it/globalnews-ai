import type { HomeFreshness, HomeRegionId, HomeStoryCard, LanguageCode } from '@globalnews-ai/shared';
import type { VisualBriefStory } from '@/lib/visual/visualBriefStore';
import type { VisualDictionary } from '@/lib/i18n/dictionaries/visualEn';
import { fill } from '@/components/home/reva/homeRevaModel';

/** PHONE-FIRST HOME CORRECTION R1 — pure view helpers for the Home story card (no I/O). */
type HomeT = VisualDictionary['home'];

export function briefStoryOfCard(card: HomeStoryCard): VisualBriefStory {
  return {
    articleRef: card.articleRef,
    url: card.url,
    title: card.title,
    summary: card.summary ?? '',
    sourceName: card.publisher,
    sourcesCount: 1 + card.otherReports.count,
    publishedAt: card.publishedAt,
    publishedAtBasis: card.publishedAtBasis,
    category: card.category as VisualBriefStory['category'],
    editorial: card,
  };
}

export function freshnessLabel(f: HomeFreshness, t: HomeT): string {
  switch (f) {
    case 'LAST_72H':
      return t.freshNew;
    case 'DEVELOPING':
      return t.freshDeveloping;
    case 'ACTIVE_DISCUSSION':
      return t.freshDiscussed;
    default:
      return t.freshEarlier;
  }
}

/** Amber is the design's ATTENTION marker for a material update — never for warnings here. */
export function isAttention(f: HomeFreshness): boolean {
  return f === 'LAST_72H' || f === 'DEVELOPING';
}

export function absoluteDate(iso: string, language: LanguageCode): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

export function domainLabel(card: Pick<HomeStoryCard, 'primaryDomain'>, t: HomeT): string | null {
  if (card.primaryDomain === 'business') return t.domainBusiness;
  if (card.primaryDomain === 'conflict') return t.domainConflict;
  return null;
}

export function otherReportsLabel(count: number, t: HomeT): string | null {
  if (count <= 0) return null;
  return count === 1 ? t.otherReportsOne : fill(t.otherReports, { count });
}

export function regionLabel(id: HomeRegionId, t: HomeT): string {
  if (id === 'region:east-africa') return t.regionEastAfrica;
  if (id === 'region:european-union') return t.regionEu;
  return t.regionMiddleEast;
}

export function storiesHref(p: { q?: string; region?: HomeRegionId | null }): string {
  const params = new URLSearchParams();
  params.set('q', p.q ?? '');
  if (p.region) params.set('region', p.region);
  return `/stories?${params.toString()}`;
}

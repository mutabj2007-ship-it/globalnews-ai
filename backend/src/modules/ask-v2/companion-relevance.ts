import type { NewsArticle } from '@globalnews-ai/shared';
import { TRAVEL_FRAME } from '../ask-router/knowledge-requirement';
import { detectRequestedDomains } from '../analysis/query/detect-analytical-domains.util';
import { hasEconomicTopicEvidence } from '../news/relevance/country-economy-relevance.util';
import { classifyCategory } from '../news/classification/classify-category.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO P0 · DEFECT E — COMPANION REPORTING MUST SERVE THE READER'S TASK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live Alpha operation e317c951-92fe-4522-bbe4-85cfbddd17ce: "Which places can i visit in RWanda?
 * list them and elaborate why." got a good background answer — and then "Recent reporting about
 * Rwanda" listing a plastics-research story, a UK asylum-scheme story and two UK genocide
 * prosecutions. They qualified only by COUNTRY + RECENCY.
 *
 * Contract: a background answer may carry current reporting only when it is materially relevant
 * to the question's own task. Country co-occurrence never qualifies an item on its own.
 *
 *   intent (from the question)          an item qualifies only if ITS OWN TEXT shows
 *   TRAVEL   (travel / visit frame)     access, closure, parks/sites, visitors/tourism, visas and
 *                                       entry, flights/roads/borders/transport, weather and natural
 *                                       disruption, curfew/security notices that affect visiting
 *   ECONOMY  (economic domain)          economic topic evidence (the governed economy reader)
 *   SECURITY (security domain)          security events (attacks, clashes, armed groups, curfew…)
 *   BUSINESS (trade / investment)       business/trade classification or economic evidence
 *   SCIENCE  (science / research)       science or technology classification
 *   none (history, plain background)    → no companion block at all
 *
 * Zero qualifying items → no block (never padding). Deterministic: no model, no provider call; it
 * filters what the existing retained read returned.
 */
export type CompanionIntent = 'TRAVEL' | 'ECONOMY' | 'SECURITY' | 'BUSINESS' | 'SCIENCE';

const SCIENCE_CUE =
  /\b(?:science|scientific|research|researchers|study|studies|technology)\b|(?:nauk\p{L}*|badani\p{L}*|technolog\p{L}*)/iu;
const BUSINESS_CUE =
  /\b(?:business|trade|investment|investors?|exports?|imports?|companies)\b|(?:biznes\p{L}*|handel\p{L}*|inwestyc\p{L}*|eksport\p{L}*)/iu;

/** The question's task, or null when current companion material would not serve it. */
export function readCompanionIntent(question: string, language: string): CompanionIntent | null {
  const lang: 'en' | 'pl' = language === 'pl' ? 'pl' : 'en';
  if (TRAVEL_FRAME[lang].test(question)) return 'TRAVEL';
  const domains = detectRequestedDomains(question).map((d) => d.domain);
  if (domains.includes('security')) return 'SECURITY';
  if (domains.includes('economic')) return BUSINESS_CUE.test(question) ? 'BUSINESS' : 'ECONOMY';
  if (BUSINESS_CUE.test(question)) return 'BUSINESS';
  if (SCIENCE_CUE.test(question)) return 'SCIENCE';
  return null;
}

/* travel-relevant developments, whole words / stems, EN + PL */
const TRAVEL_RELEVANT =
  /\b(?:clos(?:ed|ure|ures|es|ing)|reopen(?:s|ed|ing)?|national\s+parks?|parks?|reserves?|tourism|tourists?|visitors?|visas?|entry\s+(?:requirements?|rules|ban)|border\s+(?:crossings?|closed|closure|reopen\w*)|flights?|airlines?|airports?|roads?|highways?|bridges?|transport|travel\s+(?:advisory|advisories|warning|warnings|alert|alerts|ban|restrictions?)|landslides?|floods?|flooding|storms?|cyclones?|eruptions?|earthquakes?|outbreaks?|evacuat\w*|curfews?|safari|gorilla\s+trekking|permits?)\b|(?:zamknię\p{L}*|park\p{L}*\s+narodow\p{L}*|turyst\p{L}*|wiz\p{L}*|lot\p{L}*\s+|lotnisk\p{L}*|drog\p{L}*|most\p{L}*|powod\p{L}*|powódź|osuwisk\p{L}*|ostrzeżeni\p{L}*\s+dla\s+podróżnych|przejś\p{L}*\s+graniczn\p{L}*|godzin\p{L}*\s+policyjn\p{L}*)/iu;

/* migration-policy reporting that merely mentions flights or entry is not a travel notice */
const NOT_TRAVEL =
  /\b(?:deport\w*|asylum|migrants?|refugee\s+(?:scheme|deal|plan))\b|(?:deportac\p{L}*|azyl\p{L}*|migran\p{L}*)/iu;

const SECURITY_RELEVANT =
  /\b(?:attacks?|attacked|clash(?:es|ed)?|army|military|troops|soldiers|rebels?|insurgen\w*|militias?|armed|ceasefire|curfew|violence|killed|bomb\w*|explosions?|shooting|security\s+forces|unrest|kidnapp\w*|hostages?)\b|(?:atak\p{L}*|starci\p{L}*|armi\p{L}*|wojsk\p{L}*|rebeli\p{L}*|bojówk\p{L}*|zawieszeni\p{L}*\s+broni|przemoc\p{L}*|zabi\p{L}*|wybuch\p{L}*)/iu;

export function servesIntent(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  intent: CompanionIntent,
): boolean {
  const text = `${article.title ?? ''} ${article.summary ?? ''}`;
  switch (intent) {
    case 'TRAVEL':
      /* 'deportation flights' to the country is migration policy, not a travel notice */
      return TRAVEL_RELEVANT.test(text) && !NOT_TRAVEL.test(text);
    case 'ECONOMY':
      return hasEconomicTopicEvidence(article);
    case 'SECURITY':
      return SECURITY_RELEVANT.test(text);
    case 'BUSINESS':
      return (
        classifyCategory({ title: article.title ?? '', summary: article.summary ?? '' }) ===
          'business' || hasEconomicTopicEvidence(article)
      );
    case 'SCIENCE': {
      const category = classifyCategory({
        title: article.title ?? '',
        summary: article.summary ?? '',
      });
      return category === 'science' || category === 'technology';
    }
  }
}

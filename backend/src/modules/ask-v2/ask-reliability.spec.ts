import { admitsReport, anchoredQueries, countriesNamedIn, questionAnchorsOf, sameMessageSubject } from '../analysis/query/question-anchors.util';
import { normalizeAskQuestion } from '../ask-router/normalization/qualified-reading';

const categoryOf = (q: string): string | undefined => {
  const out = normalizeAskQuestion({ originalQuestion: q, sourceLanguage: 'en', normalizationLanguage: 'en', displayLanguage: 'en' } as never) as { reading?: { readerCategory?: { value: string } } };
  return out.reading?.readerCategory?.value;
};
import { readAdvisory } from '../ask-router/advisory-requirement';
import { checkWrittenArithmetic } from '../analysis/providers/arithmetic-check.util';
import { readProductMeta, productMetaAnswer } from './product-meta';
import { assessHomeEligibility, plainTopicLabels } from '../home-editorial/home-eligibility';

/**
 * ASK RELIABILITY R1 — regression matrix for the owner's observed cases A–Q (2026-10-05/06) and
 * unseen paraphrases. Fixture-level: the deterministic readers and gates, no provider, no model.
 */
describe('A — "affects the entire world" is an impact scope, not the World news category', () => {
  it.each([
    'Compare how Russia and Ukraine are currently doing and provide how this affects the entire world',
    'Comparew how how Russia and Ukraine are currently doing and provide how this affects the entire world',
    'How does the Gaza war affect the whole world?',
    'What does this mean for people around the world?',
  ])('%s', (q) => {
    expect(categoryOf(q)).not.toBe('world');
  });
  it('"world news" still names the category', () => {
    expect(categoryOf('Show me the latest world news')).toBe('world');
  });
  it('both actors are retained', () => {
    expect(countriesNamedIn('Comparew how how Russia and Ukraine are currently doing')).toEqual(['RUS', 'UKR']);
  });
});

describe('N / G — named actors, relationship and topic survive into evidence admission', () => {
  const congo = questionAnchorsOf('What change have you learned about Rwanda recently in relation to congo conflict?');
  it('Rwanda–Congo is a LINKED relationship with a conflict topic', () => {
    expect(congo.actors.map((a) => a.key)).toEqual(['RWA', 'COD']);
    expect(congo.relation).toBe('LINKED');
    expect(congo.topics.map((t) => t.key)).toEqual(['armed-conflict']);
    expect(congo.gated).toBe(true);
  });
  it.each([
    ['Condom prices soar in Rwanda as free supplies dry up', 'Youth face rising costs in Kigali'],
    ['Rwanda savings groups expand in rural districts', 'Village savings and loans grow'],
    ['Rwandan migrants return from abroad', 'Migration patterns shift'],
  ])('REJECTS unrelated Rwanda report: %s', (title, summary) => {
    expect(admitsReport(congo, { title, summary }).admitted).toBe(false);
  });
  it('ADMITS a report about the relationship itself', () => {
    expect(admitsReport(congo, { title: 'DR Congo accuses Rwanda of backing M23 rebels near Goma', summary: 'Fighting continues in North Kivu' }).admitted).toBe(true);
  });
  it('the anchored supplement keeps both actors and the topic', () => {
    expect(anchoredQueries(congo)).toEqual(['Rwanda DR Congo conflict']);
  });

  const iran = questionAnchorsOf('Tabulate your response and indicate how the influence of iranian - US war is affecting East African region');
  it('Iran–US war → East Africa keeps the originating actors, the affected region and the channel', () => {
    expect(iran.actors.map((a) => a.key)).toEqual(['IRN', 'USA', 'region:east-africa']);
    expect(iran.relation).toBe('LINKED');
    expect(iran.topics.map((t) => t.key)).toContain('armed-conflict');
  });
  it('a US deportation story about Burundi is NOT evidence of Iran–US war effects', () => {
    expect(
      admitsReport(iran, {
        title: 'Burundi agrees to accept third-country deportees from the United States',
        summary: 'Part of the Trump administration immigration policy',
      }).admitted,
    ).toBe(false);
  });
  it('paraphrase: "How is the Israel–Iran conflict affecting Kenya\'s economy?"', () => {
    const a = questionAnchorsOf("How is the Israel–Iran conflict affecting Kenya's economy?");
    expect(a.actors.map((x) => x.key)).toEqual(['ISR', 'IRN', 'KEN']);
    expect(a.relation).toBe('LINKED');
  });
});

describe('E / F — fuel prices', () => {
  const rwanda = questionAnchorsOf('Oil prices in Rwanda');
  it('topic is required: a Rwanda report without any fuel/price term is not admitted', () => {
    expect(rwanda.gated).toBe(true);
    expect(admitsReport(rwanda, { title: 'Rwanda hosts regional health summit', summary: 'Ministers meet in Kigali' }).admitted).toBe(false);
    expect(admitsReport(rwanda, { title: 'RURA sets new pump prices for petrol and diesel in Rwanda', summary: '' }).admitted).toBe(true);
  });
  it('"Compare Tanzanian oil prices vs Rwandan" names BOTH countries (demonyms) as a comparison SET', () => {
    const a = questionAnchorsOf('Compare Tanzanian oil prices vs Rwandan');
    expect(a.actors.map((x) => x.key)).toEqual(['TZA', 'RWA']);
    expect(a.relation).toBe('SET');
    expect(admitsReport(a, { title: 'EWURA announces new fuel prices in Tanzania', summary: '' }).admitted).toBe(true);
    expect(anchoredQueries(a)).toEqual(['Tanzania fuel prices', 'Rwanda fuel prices']);
  });
  it('"Indicate the oil prices today. How is it?" — "it" refers to the same message', () => {
    expect(sameMessageSubject('Indicate the oil prices today. How is it?')).toBe(true);
    expect(sameMessageSubject('How is it?')).toBe(false);
    expect(sameMessageSubject('What about it?')).toBe(false);
  });
});

describe('B — the Kenya question keeps its own subject (no field clarification)', () => {
  it('anchors carry Kenya and the economy', () => {
    const a = questionAnchorsOf(
      "What significant developments have occurred in Kenya's economy over the past seven days? Explain the three most important changes, when they happened, and how they could affect small businesses.",
    );
    expect(a.actors.map((x) => x.key)).toEqual(['KEN']);
    expect(a.topics.map((t) => t.key)).toContain('economy');
  });
});

describe('J — personal "today" advice is not a request for current reporting', () => {
  it.each(['Recommend me what i should eat today.', 'What should I wear today?', 'Recommend me a workout I should do today'])('%s', (q) => {
    expect(readAdvisory(q, 'en')).toEqual({ mode: 'ADVISORY', currentClauses: [] });
  });
  it('but "today" with a reported subject stays mixed', () => {
    expect(readAdvisory('Recommend me what I should buy today given current fuel prices', 'en')?.mode).toBe('MIXED_ADVISORY_CURRENT');
  });
});

describe('I — questions about the product are answered from trusted facts', () => {
  const facts = { model: 'gpt-4o-mini', modelProvider: 'OpenAI' };
  it.each([
    ['Which model are you using to respond to me?', 'MODEL_IDENTITY'],
    ['what AI model do you use?', 'MODEL_IDENTITY'],
    ['How can I train you to better serve in general service?', 'IMPROVE_OR_TRAIN'],
    ['You are running short of recent news', 'PRODUCT_FEEDBACK'],
    ['Your app lacks recent news', 'PRODUCT_FEEDBACK'],
  ])('%s → %s', (q, kind) => {
    expect(readProductMeta(q, 'en')).toBe(kind);
  });
  it('ordinary news questions are not meta', () => {
    expect(readProductMeta('What is the latest news from Kenya?', 'en')).toBeNull();
    expect(readProductMeta('Which model of electric car sells best in Europe?', 'en')).toBeNull();
  });
  it('the identity answer names the configured model and never claims training from chats', () => {
    const text = productMetaAnswer('MODEL_IDENTITY', 'en', facts);
    expect(text).toContain('gpt-4o-mini');
    expect(text).toMatch(/does not learn from your conversations/);
  });
  it('the improvement answer separates training from feedback and settings', () => {
    expect(productMetaAnswer('IMPROVE_OR_TRAIN', 'en', facts)).toMatch(/does not train the model/);
  });
  it('feedback is not turned into a news search', () => {
    expect(productMetaAnswer('PRODUCT_FEEDBACK', 'en', facts)).toMatch(/not searched the news/);
  });
});

describe('C — written arithmetic is recomputed', () => {
  it('sequential 5% then 2% from $2: $2.142', () => {
    const r = checkWrittenArithmetic('$2.00 × 1.05 = $2.10, then $2.10 × 1.02 = $2.04 (the price after two years is $2.04).');
    expect(r.text).toBe('$2.00 × 1.05 = $2.10, then $2.10 × 1.02 = $2.142 (the price after two years is $2.142).');
    expect(r.corrections).toHaveLength(1);
  });
  it('100 → 110 at 10% → 115.50 at 5%', () => {
    const ok = checkWrittenArithmetic('100 × 1.10 = 110, and 110 × (1 + 5%) = 115.50');
    expect(ok.corrections).toEqual([]);
    const bad = checkWrittenArithmetic('100 × 1.10 = 110, and 110 × (1 + 5%) = 115');
    expect(bad.text).toBe('100 × 1.10 = 110, and 110 × (1 + 5%) = 115.50');
  });
  it('correct steps and prose without calculations are untouched', () => {
    const text = 'Inflation fell from 5% to 2%, so prices still rose, just more slowly.';
    expect(checkWrittenArithmetic(text)).toEqual({ text, corrections: [] });
  });
});

describe('O — Home "why it is here" uses subject, not isolated words', () => {
  it('a smuggled-alcohol report mentioning "crude" spirits is not an energy story', () => {
    const v = assessHomeEligibility({
      title: 'Police seize smuggled crude spirits at Kenya border',
      summary: 'The illicit commodity was hidden in a truck',
      category: 'world',
    });
    expect(v.eligible).toBe(false);
  });
  it('a real fuel-price story is labelled in plain words', () => {
    const v = assessHomeEligibility({ title: 'Kenya raises fuel prices as crude oil costs climb', summary: '', category: 'business' });
    expect(v.eligible).toBe(true);
    if (v.eligible) expect(plainTopicLabels(v.signals.business)).toContain('Energy and fuel');
  });
});

describe('O — the exact live Alpha counterexample (Taarifa, 2026-10-05)', () => {
  it('"Rwandans Turn To Very Cheap Smuggled Alcohol From Burundi" is not admitted on common words alone', () => {
    const v = assessHomeEligibility({
      title: 'Rwandans Turn To Very Cheap Smuggled Alcohol From Burundi',
      summary:
        'On a Thursday at 7 PM sharp, electricity goes off… load shedding… a convoy of motorcycles loaded with bags of crude spirits; the illicit commodity crosses the border.',
      category: 'world',
    });
    expect(v.eligible).toBe(false);
  });
});

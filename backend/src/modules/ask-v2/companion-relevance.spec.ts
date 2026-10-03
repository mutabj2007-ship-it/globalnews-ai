import { readCompanionIntent, servesIntent } from './companion-relevance';

/**
 * CTO P0 · Defect E — the companion block's task reading and per-item relevance rule
 * (deterministic: plain functions, no model, no provider, no I/O).
 */
describe('readCompanionIntent — which task, if any, current material can serve', () => {
  it.each([
    ['Which places can i visit in RWanda? list them and elaborate why.', 'en', 'TRAVEL'],
    ['I want to travel to Kenya next month, what should I know?', 'en', 'TRAVEL'],
    ['Jakie miejsca warto odwiedzić w Rwandzie?', 'pl', 'TRAVEL'],
    ["How is Madagascar's economy doing?", 'en', 'ECONOMY'],
    ['What is the security situation in Mali?', 'en', 'SECURITY'],
    ['What are the trade and investment opportunities in Ghana?', 'en', 'BUSINESS'],
    ['What scientific research is done in Rwanda?', 'en', 'SCIENCE'],
  ] as const)('"%s" → %s', (q, lg, intent) => {
    expect(readCompanionIntent(q, lg)).toBe(intent);
  });

  it.each([
    ['What is the history of Rwanda?'],
    ['Who was the first president of Tanzania?'],
    ['What language is spoken in Senegal?'],
  ])('"%s" → none (no companion block)', (q) => {
    expect(readCompanionIntent(q, 'en')).toBeNull();
  });
});

describe('servesIntent — an item qualifies only by its OWN text, never country + recency', () => {
  const a = (title: string, summary = '') => ({ title, summary });

  it('economy: economic reporting qualifies; a crime story does not', () => {
    expect(
      servesIntent(a('Rwanda inflation eases to 4% as central bank holds rates'), 'ECONOMY'),
    ).toBe(true);
    expect(servesIntent(a('Man charged over Rwanda genocide in first for U.K.'), 'ECONOMY')).toBe(
      false,
    );
  });

  it('security: a clash qualifies; a materials-science story does not', () => {
    expect(servesIntent(a('Clashes reported near the Rwanda–DRC border'), 'SECURITY')).toBe(true);
    expect(servesIntent(a('Researchers turn plastic waste into tiles'), 'SECURITY')).toBe(false);
  });

  it('science: research qualifies; an asylum-scheme story does not', () => {
    expect(servesIntent(a('Scientists discover new species of frog in Nyungwe'), 'SCIENCE')).toBe(
      true,
    );
    expect(servesIntent(a("EU copies Britain's Rwanda scheme"), 'SCIENCE')).toBe(false);
  });

  it('travel: migration policy that mentions flights is not a travel notice', () => {
    expect(servesIntent(a('First deportation flight to Rwanda departs'), 'TRAVEL')).toBe(false);
    expect(servesIntent(a('Kigali airport adds new flights to Europe'), 'TRAVEL')).toBe(true);
  });
});

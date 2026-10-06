import { assessHomeEligibility, plainTopicLabels } from './home-eligibility';

/**
 * HOME DATA TRUTH CORRECTION R1 · B1 — subject-level admission, tested on wording that is NOT the
 * East Africa controller's literal probe set (that floor lives in home-eligibility.ea-unseen.spec).
 */
type Case = [label: string, title: string, summary?: string];
const verdict = (title: string, summary = '') => assessHomeEligibility({ title, summary, category: 'world' });

const MUST_REJECT: Case[] = [
  ['common word: bank (building)', 'Robbers tunnel into bank vault in Arusha', 'Police are hunting the gang.'],
  ['common word: port (place name)', 'Port Sudan residents queue for water', 'Taps ran dry over the weekend.'],
  ['common word: stock (verb)', 'Families stock up on candles before the storm', 'Shops sold out by noon.'],
  ['common word: shipping (retail)', 'Retailer cuts shipping times for city customers', 'Orders now arrive the next day.'],
  ['common word: jobs (name)', 'Biography of Jobs tops bestseller list', 'Readers queued at bookshops.'],
  ['common word: market (place)', 'Night market draws crowds in Kigali', 'Vendors sold grilled maize.'],
  ['common word: electricity (incidental)', 'Village celebrates first wedding season since electricity arrived', 'Guests danced late into the night.'],
  ['common word: crude (adjective)', 'Artist carves crude wooden masks for festival', 'The masks were sold out.'],
  ['war (metaphor)', 'Supermarkets wage war on plastic bags', 'Shoppers must bring their own.'],
  ['conflict (procedural)', 'Judge recuses herself citing conflict of interests', 'The case was reassigned.'],
  ['offensive (remark)', 'Broadcaster suspended over offensive comments', 'Viewers complained.'],
  ['invasion (privacy)', 'Celebrity photos case ruled an invasion of privacy', 'Damages were awarded.'],
  ['occupation (job)', 'Teaching tops list of most respected occupations', 'Doctors came second.'],
  ['attack (animal)', 'Hippo attack leaves fisherman injured on Lake Naivasha', 'He was taken to hospital.'],
  ['lone weak conflict words', 'Two killed as police disperse protest in Nairobi', 'Officers fired tear gas.'],
  ['sport takeover', 'Businessman completes takeover of AFC Leopards FC', 'Fans welcomed the investment.'],
  ['sport sponsorship', 'Brewer signs sponsorship deal with national rugby team', 'The deal runs for five years.'],
  ['historical war framing', 'War photographer’s archive goes on display', 'The images span four decades.'],
  ['incidental strong phrase deep in a long text', 'Families adapt to life in the hills', 'Children walk to school each morning. Later in the week, load shedding returned.'],
];

const MUST_ADMIT: Array<[...Case, 'business' | 'conflict']> = [
  ['duty paraphrase', 'Nairobi raises duty on imported cooking oil', 'Refiners say local producers will benefit.', 'business'],
  ['tariff paraphrase', 'Kampala slaps new tariffs on steel from abroad', '', 'business'],
  ['staple price paraphrase', 'Cost of rice jumps in Bujumbura markets', 'Traders blame a weaker franc.', 'business'],
  ['trade disruption paraphrase', 'Flooding halts freight on the Northern Corridor', 'Hundreds of trucks are stuck near Naivasha.', 'business'],
  ['energy disruption', 'Power outages force Addis factories to cut shifts', '', 'business'],
  ['refinery dispute', 'Court halts refinery expansion in Tanga over land claims', '', 'business'],
  ['company results', 'Bank of Kigali profit climbs as lending grows', '', 'business'],
  ['armed seizure paraphrase', 'Rebels capture strategic town in North Kivu', 'Residents fled towards Goma.', 'conflict'],
  ['displacement + armed actors', 'Thousands displaced as militias torch villages', 'Aid agencies are overwhelmed.', 'conflict'],
  ['war tied to a place', 'Sudan war enters third year with no talks in sight', '', 'conflict'],
  ['ceasefire', 'Mediators push for truce in Somalia border region', '', 'conflict'],
  ['lead-sentence evidence corroborated', 'A town on the edge', 'Fighters seized the town of Kamituga on Monday as thousands fled the clashes.', 'conflict'],
];

describe('B1 · common or ambiguous single words never admit by themselves', () => {
  it.each(MUST_REJECT)('%s → rejected', (_label, title, summary) => {
    expect(verdict(title, summary).eligible).toBe(false);
  });
});

describe('B1 · governed phrase families and multi-signal subject evidence admit paraphrases', () => {
  it.each(MUST_ADMIT)('%s → admitted', (_label, title, summary, domain) => {
    const v = verdict(title, summary);
    expect(v.eligible).toBe(true);
    if (v.eligible) expect(v.domains).toContain(domain);
  });
});

describe('B1 · business and conflict stay separate', () => {
  it('"trade war" is trade evidence, never armed-conflict evidence', () => {
    const v = verdict('Washington and Beijing slide toward a trade war', 'New duties on electronics take effect.');
    expect(v.eligible && v.domains).toEqual(['business']);
  });
  it('a trade war story with separate armed-conflict evidence is both', () => {
    const v = verdict('Trade war deepens as airstrikes hit border town', '');
    expect(v.eligible && [...v.domains].sort()).toEqual(['business', 'conflict']);
  });
});

describe('B2 · the reason is the admitting families in plain words, never raw tokens', () => {
  it('the smuggled-alcohol pattern yields no business reason at all', () => {
    expect(verdict('Cheap smuggled spirits flood border towns', 'Crude brew is a common commodity; electricity goes off at night.').eligible).toBe(false);
  });
  it('labels come from evidence families', () => {
    const v = verdict('Kenya raises fuel prices as crude oil costs climb');
    expect(v.eligible && plainTopicLabels(v.signals.business)[0]).toBe('Energy and fuel');
    expect(v.eligible && v.signals.business.every((k) => /^[a-z-]+$/.test(k))).toBe(true);
  });
});

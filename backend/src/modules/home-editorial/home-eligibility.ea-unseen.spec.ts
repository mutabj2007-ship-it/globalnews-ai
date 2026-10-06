import { assessHomeEligibility } from './home-eligibility';

/**
 * EAST AFRICA CONTROLLER — HOME DATA TRUTH REVIEW of 9720f42 (2026-10-06): the 33 UNSEEN /
 * paraphrased probe cases (13/33 matched expectation on 9720f42), plus the live-store failures.
 * Handoff for HOME DATA TRUTH CORRECTION R1 (B1). Drop into backend/src/modules/home-editorial/.
 * These are a REGRESSION FLOOR, not the rule: CTO §3 forbids satisfying them by hard-coding literals.
 */
type Case = [label: string, expect: 'IN' | 'OUT', title: string, summary: string, category?: string];

const PROBE: Case[] = [
  ['country only', 'OUT', 'Kenya celebrates Mashujaa Day with parades in Nairobi', 'Crowds gathered across the country.'],
  ['marketplace', 'OUT', 'Fire guts traders’ stalls at Gikomba market', 'Traders counted losses after the blaze at the open-air market.'],
  ['security non-conflict', 'OUT', 'Airport tightens security screening ahead of holiday travel', 'Passengers were asked to arrive early.'],
  ['cyber security', 'OUT', 'Bank warns customers of phishing scam targeting mobile users', 'Customers should not share their PINs.'],
  ['energy business', 'IN', 'Uganda signs deal to build oil refinery with UAE firm', 'The project is expected to cost billions.'],
  ['tariffs paraphrase', 'IN', 'Dar es Salaam hikes levies on imported sugar to shield local mills', 'Millers welcomed the duty increase.'],
  ['inflation paraphrase', 'IN', 'Prices of maize flour climb for third month in Kampala', 'Households are paying more for staples as costs rise.'],
  ['cross-border', 'IN', 'Truck drivers stranded as Kenya-Uganda border crossing slows cargo', 'Delays at Malaba are disrupting freight and exports to Rwanda.'],
  ['sport sponsorship', 'OUT', 'Betting firm signs record sponsorship deal with Gor Mahia', 'The club will receive the money over three seasons.'],
  ['club takeover', 'OUT', 'Investor completes takeover of Tusker FC', 'The club said the investment will fund a new stadium.'],
  ['celebrity brand', 'OUT', 'Diamond Platnumz launches perfume brand in Dar es Salaam', 'Fans queued for the singer’s new product.'],
  ['company-name ambiguity', 'IN', 'Safaricom profit rises as M-Pesa revenue grows', 'The operator reported higher earnings.'],
  ['crude liquor', 'OUT', 'Police seize crude liquor in Kiambu crackdown', 'Officers poured out drums of illicit brew.'],
  ['crude alcohol smuggling', 'OUT', 'Smugglers of crude alcohol arrested at Busia', 'The brew was hidden in a lorry.'],
  ['bank holiday', 'OUT', 'What is open on the bank holiday weekend in Nairobi', 'Shops will keep shorter hours.'],
  ['Port Harcourt', 'OUT', 'Port Harcourt residents mourn victims of flooding', 'Homes were destroyed by heavy rain.'],
  ['river bank', 'OUT', 'Children rescued after river bank collapses in Kisumu', 'Rescuers pulled three pupils from the water.'],
  ['tax joke', 'OUT', 'Comedian jokes about tax at sold-out show', 'The audience laughed.'],
  ['stock up', 'OUT', 'Shoppers stock up on snacks before the long weekend', 'Supermarkets were busy.'],
  ['free shipping', 'OUT', 'Online retailer offers free shipping on festive gifts', 'Customers can order until Friday.'],
  ['jobs as name', 'OUT', 'Film about Steve Jobs screens in Nairobi', 'The biopic drew a large crowd.'],
  ['conflict of interest', 'OUT', 'MPs raise conflict of interest over tender committee', 'Lawmakers want members to declare holdings.'],
  ['offensive remarks', 'OUT', 'Minister apologises for offensive remarks about teachers', 'Unions demanded an apology.'],
  ['occupation (job)', 'OUT', 'Survey ranks nursing as most trusted occupation', 'Teachers came second.'],
  ['invasion of privacy', 'OUT', 'Court rules phone tapping was an invasion of privacy', 'The judge awarded damages.'],
  ['dog attack weak x3', 'OUT', 'Police say boy killed in dog attack in Eldoret', 'The animal was put down.'],
  ['heart attack', 'OUT', 'Veteran journalist dies of heart attack', 'Tributes poured in.'],
  ['trade war (business, not conflict)', 'IN', 'EU and China edge toward trade war over electric cars', 'Brussels threatened higher duties.'],
  ['conflict paraphrase', 'IN', 'Gunmen kill villagers in eastern Congo raid', 'Residents fled into the forest after the assault.'],
  ['conflict no keyword', 'IN', 'Thousands flee as fighters seize town in South Sudan', 'Aid groups warned of a growing crisis.'],
  ['al-Shabaab', 'IN', 'Al-Shabaab militants storm military base in Somalia', 'Several soldiers were reported dead.'],
  ['entertainment paraphrase', 'OUT', 'Nairobi star thrills fans with surprise performance', 'The crowd sang along.'],
  ['gaming paraphrase', 'OUT', 'New smartphone title tops download charts in Kenya', 'Players praised the graphics.'],
];

/* Live Alpha failures (read-only export, 2026-10-05). Titles verbatim; summaries abbreviated. */
const LIVE: Case[] = [
  ['live: smuggled alcohol', 'OUT', 'Rwandans Turn To Very Cheap Smuggled Alcohol From Burundi', 'Cheap illicit brew from Burundi is replacing local drinks.', 'politics'],
  ['live: racist remark', 'OUT', 'Trump slammed for ‘heinously racist’ remark to African reporter', 'Critics condemned the comment.', 'politics'],
  ['live: war photographer', 'OUT', 'Meet Warren Buffett’s son Howard, a former sheriff, war photographer, and Berkshire’s new chairman', 'Howard Buffett takes over the board.', 'world'],
  ['live: tug-of-war', 'OUT', 'Tooro Kingdom’s New Era Amid Succession Tug-Of-War', 'Royal family members dispute the succession.', 'politics'],
  ['live: Nazi-looted art', 'OUT', 'New laws trigger a fresh legal fight over Nazi-looted art in Los Angeles and Auschwitz museums', 'Heirs are seeking restitution.', 'politics'],
  ['live: declaration', 'OUT', 'BRICS adopts New Delhi Declaration with consensus', 'Leaders agreed a joint statement.', 'politics'],
];

describe('B1 · Home eligibility is subject-level (East Africa unseen + live regression floor)', () => {
  /* rest parameters: a 5-parameter callback over 4-element rows makes Jest pass `done` (timeout) */
  it.each([...PROBE, ...LIVE])('%s → %s', (...row: Case) => {
    const [, want, title, summary, category] = row;
    const v = assessHomeEligibility({ title, summary, category: category ?? 'world' });
    expect(v.eligible ? 'IN' : 'OUT').toBe(want);
  });

  it('trade war is BUSINESS unless there is separate armed-conflict evidence (CTO §2.D)', () => {
    const v = assessHomeEligibility({ title: 'EU and China edge toward trade war over electric cars', summary: 'Brussels threatened higher duties.', category: 'world' });
    expect(v.eligible && v.primary).toBe('business');
  });
});

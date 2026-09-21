import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';

const source = readFileSync(join(__dirname, 'TodayGeographicIntelligence.tsx'), 'utf-8');
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const code = codeOnly(source);

describe('R2 Today geography — the precision ceiling is enforced by a build failure', () => {
  it('renders nothing finer than a country, and names no sub-national unit anywhere', () => {
    /*
      THE PERMANENT RULE: displayed geographic precision <= evidence precision.
      NewsArticle carries countryCode and countryName and nothing finer; no
      coordinate, region, district, county or voivodeship exists in any
      contract or table. This guard fails the build rather than trusting review.
    */
    for (const forbidden of [
      'latitude',
      'longitude',
      'centroid',
      'coordinate',
      'district',
      'county',
      'province',
      'voivodeship',
      'region',
    ]) {
      expect(code.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('draws no map, no shape and no choropleth — at any tier', () => {
    for (const forbidden of ['<svg', 'countryGeometry', 'countryFocusPoint', 'computeFeatureCenter', 'choropleth', 'TileGrid', 'topojson', 'path d=']) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('resolves country names through the ONE canonical resolver, never a second implementation', () => {
    expect(code).toMatch(/import \{ getCountryDisplayName \} from '@\/lib\/countryDisplayName'/);
    expect(code).toMatch(/getCountryDisplayName\(row\.countryCode, language, row\.countryName\)/);
    expect(code).not.toContain('Intl.DisplayNames');
  });
});

describe('R2 Today geography — the unresolved row is first class', () => {
  it('renders unresolved records with their own count whenever there are any', () => {
    expect(code).toMatch(/\{unresolvedCount > 0 && \(/);
    expect(code).toContain('t.unresolvedLabel');
    expect(code).toContain('{unresolvedCount}');
  });

  it('states that absence means unknown, never nowhere', () => {
    expect(code).toContain('t.unresolvedNote');
    expect(getDictionary('en').today.unresolvedNote).toMatch(/do not know/);
  });

  it('does NOT offer unresolved as a selectable country — an absence of evidence is not a place', () => {
    const block = code.slice(code.indexOf('unresolvedCount > 0 &&'), code.indexOf('</ul>'));
    expect(block).not.toContain('onSelectCountry');
    expect(block).not.toContain('aria-pressed');
  });
});

describe('R2 Today geography — controls are real, reachable and never hover-only', () => {
  it('uses real buttons with aria-pressed, because the homepage focus chain never fires on touch', () => {
    expect(code).toMatch(/<button\s+type="button"/);
    expect((code.match(/aria-pressed=/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(code).toMatch(/onClick=\{\(\) => onSelectCountry\(null\)\}/);
    expect(code).toMatch(/onClick=\{\(\) => onSelectCountry\(row\.countryCode\)\}/);
  });

  it('never puts an affordance behind hover alone', () => {
    expect(code).not.toMatch(/onMouseEnter|onMouseOver|onPointerEnter/);
  });

  it('meets the 44px touch target and carries a visible focus treatment', () => {
    expect(code).toMatch(/min-h-\[44px\]/);
    expect(code).toMatch(/focus-visible:outline-gn-focus/);
    // Selection is never carried by colour alone: aria-pressed is the state.
    expect(code).toMatch(/aria-pressed=\{selectedCountry === null\}/);
  });
});

describe('R2 Today geography — the mandatory contract and its accessible equivalent', () => {
  it('renders the R-34 contract footer with every field in the fixed order', () => {
    const contract = code.slice(code.indexOf('const contract = ['), code.indexOf("].join(' · ')"));
    const order = [
      'contractMetricLabel',
      'contractUnitLabel',
      'contractGeographyLabel',
      'contractPeriodLabel',
      'contractBasisLabel',
      'contractUpdatedLabel',
      'contractCoverageLabel',
    ];
    let last = -1;
    for (const field of order) {
      const index = contract.indexOf(field);
      expect(index).toBeGreaterThan(last);
      last = index;
    }
  });

  it('states an ABSOLUTE period, never a relative one', () => {
    expect(code).toMatch(/windowStart\.slice\(0, 10\)/);
    expect(code).toMatch(/00:00–24:00 UTC/);
    expect(code).not.toMatch(/recent|Recent|last 24|past/);
  });

  it('says COVERAGE was not assessed rather than omitting the field, because silence would read as adequate', () => {
    expect(code).toContain('t.contractCoverageValue');
    expect(getDictionary('en').today.contractCoverageValue).toBe('not assessed');
  });

  /*
    CONVERTED UNDER CTO-APPROVED R2.1 C8, AND STRICTER THAN WHAT IT REPLACED.

    This asserted <details> and <summary>. C8 requires aria-expanded BOUND TO
    STATE, and a static aria-expanded on a <summary> would have been an attribute
    that did not track anything — so the disclosure is now a real button with real
    state. Everything the original protected still holds and is still asserted:
    the table is real, it has a caption, and it has column and row scopes. What
    is added is the binding itself, the control relationship, and the visible
    chevron, none of which the <details> version could express.
  */
  it('provides the on-demand data table behind a REAL disclosure whose state is bound', () => {
    // The control, and the binding.
    expect(code).toMatch(/<button/);
    expect(code).toMatch(/aria-expanded=\{valuesShown\}/);
    expect(code).toMatch(/aria-controls="today-geo-values"/);
    expect(code).toMatch(/id="today-geo-values"/);
    expect(code).toMatch(/onClick=\{\(\) => setValuesShown\(\(shown\) => !shown\)\}/);
    // A VISIBLE disclosure cue that changes with the state, and is not an icon:
    // this component draws no SVG.
    expect(code).toMatch(/valuesShown \? '\\u25be' : '\\u25b8'/);
    expect(code).toMatch(/valuesShown \? t\.hideValues : t\.showValues/);
    // The disclosure ink is the released toggle colour, not an invented one.
    expect(code).toMatch(/text-gn-ink-toggle/);
    // And the table itself is unchanged in substance.
    expect(code).toMatch(/<table/);
    expect(code).toMatch(/<caption className="sr-only">\{t\.tableCaption\}<\/caption>/);
    expect((code.match(/scope="col"/g) ?? [])).toHaveLength(2);
    expect(code).toMatch(/scope="row"/);
    // The old element is genuinely gone, not merely wrapped.
    expect(code).not.toMatch(/<details|<summary/);
  });

  it('R2.1 C3 — the unresolved row is SUBORDINATE but complete, in the reserved unknown neutral', () => {
    expect(code).toMatch(/text-gn-geo-country text-gn-hud-faint/);
    expect(code).toMatch(/text-gn-hud-value text-gn-hud-faint/);
    // The count and the caption both survive the demotion.
    expect(code).toContain('{unresolvedCount}');
    expect(code).toContain('t.unresolvedNote');
  });

  it('R2.1 C5 — the module is an anchor target, so the compact summary can hand off to it', () => {
    expect(code).toMatch(/id="today-geography"/);
  });
});

describe('R2 Today geography — the World Map handoff', () => {
  it('carries ISO-3 scope and semantic selection without performing a read', () => {
    expect(code).toContain('/map?country=');
    expect(code).toContain('&sel=');
    expect(code).toContain('country:');
    expect(code).toContain('encodeURIComponent');
    expect(code).toMatch(/selectedCountry === null\s*\?\s*'\/map'/);
  });

  it('promises only to open the World Map; selection itself remains provider-free', () => {
    expect(code).toMatch(/aria-label=\{t\.openWorldMap\}/);
    const en = getDictionary('en').today.openWorldMap;
    expect(en).toBe('Open the World Map');
    expect(code).not.toMatch(/fetchCountryNews|performCountryRead|fetch\s*\(/);
  });
});

describe('R4 Watch — the follow control on a country row', () => {
  it('renders the released control and never a forked second one', () => {
    expect(code).toMatch(
      /import \{ CountryFollowControl \} from '@\/components\/home\/CountryFollowControl'/,
    );
    expect(code).toMatch(/<CountryFollowControl/);
    expect(code).not.toMatch(/<button[^>]*aria-pressed=\{isFollowed\}/);
  });

  it('renders NOTHING for a visitor with no follow list — a dead affordance invites a tap that cannot work', () => {
    expect(code).toMatch(/followedCodes !== null/);
    expect(code).toMatch(/\{showControl && \(/);
    expect(code).not.toMatch(/disabled=/);
    expect(code).not.toMatch(/aria-disabled/);
  });

  it('offers FOLLOW only while the account is under the ceiling, and UNFOLLOW always', () => {
    expect(code).toMatch(
      /const showControl =\s*followedCodes !== null && followCode !== undefined && \(isFollowed \|\| !atFollowLimit\);/,
    );
  });

  it('joins the two alphabets through the canonical resolver, never by truncation', () => {
    expect(code).toMatch(/const followCodeFor = \(row: TodayCountryCount\): string \| undefined =>/);
    expect(code).toMatch(/findCountryByIso2\(row\.countryCode\)\?\.iso3/);
    expect(code).not.toMatch(/slice\(0,\s*2\)|substring\(0,\s*2\)|substr\(0,\s*2\)/);
  });

  it('holds no follow state and issues no request of its own — the hook has ONE instance, in TodaySection', () => {
    expect(code).not.toContain('useCountryFollows');
    expect(code).not.toContain('accountFetch');
    expect(code).not.toMatch(/useEffect|setInterval|setTimeout|WebSocket|EventSource/);
    // The only state this component owns is the values disclosure.
    expect((code.match(/useState/g) ?? [])).toHaveLength(2);
  });

  it('addresses pending and failed BY COUNTRY, so one slow row cannot disturb another', () => {
    expect(code).toMatch(/isPending=\{pendingCountry === followCode\}/);
    expect(code).toMatch(/hasFailed=\{failedCountry === followCode\}/);
  });

  it('keeps the control OUT of the unresolved row — an absence of evidence cannot be followed', () => {
    const block = code.slice(code.indexOf('unresolvedCount > 0 &&'), code.indexOf('</ul>'));
    expect(block).not.toContain('CountryFollowControl');
    expect(block).not.toContain('onFollow');
  });

  it('leaves every R2 guarantee on this surface intact', () => {
    // The selection button is still the row's own control, and still 44px.
    expect(code).toMatch(/onClick=\{\(\) => onSelectCountry\(row\.countryCode\)\}/);
    expect(code).toMatch(/aria-pressed=\{selectedCountry === row\.countryCode\}/);
    expect(code).toMatch(/min-h-\[44px\]/);
    // And the row still lays out as a row, with the control beside the button
    // rather than nested inside it — a button inside a button is not a control.
    expect(code).toMatch(/<li key=\{row\.countryCode\} className="flex items-center gap-\[6px\]">/);
    expect(code).toMatch(/'flex min-w-0 flex-1 min-h-\[44px\]/);
  });
});

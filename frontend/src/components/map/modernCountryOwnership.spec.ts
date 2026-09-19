/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHASE A — WHO OWNS THE SELECTED-COUNTRY READER EXPERIENCE IN THE MODERN SHELL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE CORRECTION THIS FILE EXISTS TO MAKE PERMANENT.
 *
 * `MAIN-COUNTRY-READER-RETRIEVAL-CONTRACT-R1` designs its seam into
 * `CountryPanel`: §2 ends at *"CountryPanel.response"*, §5 names *"the panel's
 * own branches"*, §6 populates `CountryContextShelf` and the
 * `CountryArticleCard` stream, and §7.2 corrects `t.noSelectionPrompt`.
 *
 * Every one of those is LEGACY. Alpha runs the modern Map Shell
 * (`NEXT_PUBLIC_MAP_SHELL=true`, verified against the deployed bundle), and in
 * that variant `MapPageClient` returns before `CountryPanel` is ever reached.
 *
 * So a faithful implementation of Main's contract, applied where Main points,
 * would fit the handle to a door Alpha does not open. That is not a criticism
 * of the contract — its request type, its refusals, its state names and its
 * cost class are all variant-independent and are landed unchanged. It is a
 * statement about WHERE they attach.
 *
 * A comment saying so would rot. These assertions cannot.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');
const raw = (...p: string[]): string => readFileSync(join(SRC, ...p), 'utf-8');

const CLIENT = raw('components', 'map', 'MapPageClient.tsx');
const SHELL = raw('components', 'map', 'shell', 'GlobalMapShell.tsx');

/** Line numbers are the evidence here, so the file is read as lines. */
const lines = CLIENT.split('\n');
const lineOf = (needle: string): number => {
  const i = lines.findIndex((l) => l.includes(needle));
  expect(`${needle} found: ${i !== -1}`).toBe(`${needle} found: true`);
  return i + 1;
};

describe('A · the modern shell returns before CountryPanel is reachable', () => {
  it('the shell branch opens, returns, and closes ABOVE the legacy return', () => {
    /*
      The structure, measured rather than described:

        if (mapVariant === 'shell') {   <- the modern branch opens
          return ( … )                  <- and returns from inside it
        }
        return ( … )                    <- the LEGACY branch
          <CountryPanel … />            <- reached only from there
    */
    const shellBranch = lineOf("if (mapVariant === 'shell') {");
    const countryPanel = lineOf('<CountryPanel');

    /*
      The legacy return is the last top-level `return (` in the component —
      found by scanning for a `return (` at exactly two-space indentation that
      sits after the shell branch. Two-space indentation is the component body;
      anything deeper is inside a branch.
    */
    const legacyReturn = lines.reduce(
      (acc, l, i) => (i + 1 > shellBranch && /^ {2}return \(\s*$/.test(l) ? i + 1 : acc),
      -1,
    );
    expect(`legacy return found: ${legacyReturn > 0}`).toBe('legacy return found: true');

    expect(`shell(${shellBranch}) < legacyReturn(${legacyReturn}): ${shellBranch < legacyReturn}`)
      .toBe(`shell(${shellBranch}) < legacyReturn(${legacyReturn}): true`);
    expect(`CountryPanel(${countryPanel}) is AFTER the legacy return: ${countryPanel > legacyReturn}`)
      .toBe(`CountryPanel(${countryPanel}) is AFTER the legacy return: true`);
  });

  it('CountryPanel is rendered exactly ONCE, and never inside the shell branch', () => {
    /*
      One render site is what makes the line-order argument above sufficient.
      A second one inside the shell branch would defeat it silently, so the
      count is pinned rather than assumed.
    */
    const renders = CLIENT.split('<CountryPanel').length - 1;
    expect(`CountryPanel render sites: ${renders}`).toBe('CountryPanel render sites: 1');
  });

  it('the component says so itself, in the bytes — this is not an inference', () => {
    /*
      Two accepted comments already record the answer. They are quoted here so
      that deleting them does not quietly delete the finding.
    */
    expect(CLIENT).toContain('The legacy CountryPanel path is NOT deleted. It is still what the');
    expect(CLIENT).toContain('THE PANEL IS NOT DELETED. It is still the accepted surface at');
  });
});

describe('A · the modern owner is EvidenceSelectionCard, by elimination and by name', () => {
  it('the modern rail routes a COUNTRY selection to EvidenceSelectionCard', () => {
    /*
      The rail's chain, in `GlobalMapShell`:

        selection === null      -> ContextSummaryPanel   (Country/World summary)
        selection.kind CITY     -> CityIdentityCard
        selection.kind REGION   -> RegionIdentityCard
        else                    -> EvidenceSelectionCard   <- COUNTRY lands here

      COUNTRY is the only remaining kind, so the `else` IS the country branch.
    */
    expect(SHELL).toContain('<EvidenceSelectionCard');
    expect(SHELL).toContain("selection.kind === 'CITY'");
    expect(SHELL).toContain("selection.kind === 'REGION'");
    /* and the legacy panel is not rendered by the modern shell at all */
    expect(`shell renders CountryPanel: ${SHELL.includes('<CountryPanel')}`)
      .toBe('shell renders CountryPanel: false');
  });

  it('the card is built to consume a CountryNewsResponse — the adapters already exist', () => {
    /*
      THIS IS WHY THE MODERN SURFACE IS A DOOR WITH NO HANDLE RATHER THAN NO
      DOOR. Every block Main's §6 says a successful retrieval populates has a
      landed adapter keyed off `CountryNewsResponse` / `NewsArticle[]`, and the
      card already declares each as an optional prop.
    */
    const intel = raw('lib', 'map', 'selection', 'selectionIntelligence.ts');
    for (const adapter of [
      'export function providerStatusFrom',
      'export function coverageStateFrom',
      'export function categoryDistribution',
      'export function retainedItemsFrom',
      'export function retainedTopics',
    ]) {
      expect(`${adapter}: ${intel.includes(adapter)}`).toBe(`${adapter}: true`);
    }
    expect(intel).toContain('providerStatusFrom(response: CountryNewsResponse)');

    const card = raw('components', 'map', 'shell', 'EvidenceSelectionCard.tsx');
    for (const prop of [
      'readonly providerStatus?: ProviderStatus;',
      'readonly coverage?: CoverageState;',
      'readonly items?: readonly RetainedItem[];',
      'readonly topics?: readonly string[];',
    ]) {
      expect(`${prop}: ${card.includes(prop)}`).toBe(`${prop}: true`);
    }
  });
});

describe('A · and the legacy panel is left exactly as it was', () => {
  it('CountryPanel still renders its error prop verbatim — reported, not touched', () => {
    /*
      Main's §5.1 finding, re-measured here and DELIBERATELY NOT FIXED.

      The instruction is explicit: *"Do not modify the legacy panel merely
      because Main identified a ready seam there."* The defect is real and it is
      recorded — including in the round's report — but the legacy surface is
      not what Alpha serves, and changing it would be changing a component this
      round has no acceptance evidence for.

      If this assertion ever fails, someone has edited the legacy panel and
      should say why.
    */
    const panel = raw('components', 'map', 'CountryPanel.tsx');
    expect(panel).toContain('error: string | null;');
    expect(panel).toMatch(/if \(error\) \{/);
  });
});

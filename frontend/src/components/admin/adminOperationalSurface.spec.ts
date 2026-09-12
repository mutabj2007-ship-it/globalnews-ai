import { readFileSync } from 'fs';
import { join } from 'path';
import { adminEn } from '@/lib/i18n/dictionaries/adminEn';
import { adminPl } from '@/lib/i18n/dictionaries/adminPl';

/**
 * MVP-G4 — the operational surface, asserted against the shipped source.
 *
 * Three properties matter here, and none of them can be proven by
 * rendering a component in this harness (the frontend test environment
 * is `node`, with no DOM). They are proven the way every other
 * frontend contract in this codebase is: by reading the source that
 * ships.
 *
 *   1. Provider prose cannot be rendered, because no code reads it and
 *      no dictionary key exists to label a column for it.
 *   2. Serving and synthetic are both rendered, so a registered
 *      provider can never be mistaken for a serving one.
 *   3. An absent ingestion aggregate renders UNAVAILABLE, never a zero.
 */
const SCREENS = join(__dirname, 'screens');
const OPERATIONS = readFileSync(join(SCREENS, 'OperationsScreen.tsx'), 'utf-8');
const SYSTEM_HEALTH = readFileSync(join(SCREENS, 'SystemHealthScreen.tsx'), 'utf-8');

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('G4-4 — no provider prose can reach the admin surface', () => {
  it('OperationsScreen reads no `message` field from a provider row', () => {
    expect(stripComments(OPERATIONS)).not.toContain('row.message');
  });

  it('neither dictionary carries a label for a provider detail column', () => {
    [adminEn, adminPl].forEach((dictionary) => {
      expect(
        Object.prototype.hasOwnProperty.call(dictionary.screens.operations.columns, 'message'),
      ).toBe(false);
    });
  });

  it('the client contract has no field the prose could arrive in', () => {
    const types = readFileSync(
      join(__dirname, '..', '..', 'lib', 'admin', 'adminApiTypes.ts'),
      'utf-8',
    );
    const providerType = types.slice(
      types.indexOf('export interface AdminProviderHealth'),
      types.indexOf('export interface AdminNewsProvidersResponse'),
    );

    expect(providerType.length).toBeGreaterThan(0);
    expect(providerType).not.toContain('message');
  });
});

describe('G4-3 — serving and synthetic are both visible', () => {
  it('the table renders whether each provider is serving reads', () => {
    expect(OPERATIONS).toContain('row.enabled');
    expect(OPERATIONS).toContain('screen.columns.serving');
  });

  it('the table renders whether each provider is synthetic', () => {
    expect(OPERATIONS).toContain('row.providerKind');
    expect(OPERATIONS).toContain('screen.providerKinds');
  });

  it('both languages label all three provider kinds and both serving states', () => {
    [adminEn, adminPl].forEach((dictionary) => {
      const operations = dictionary.screens.operations;

      expect(Object.keys(operations.providerKinds).sort()).toEqual(['MOCK', 'REAL', 'UNKNOWN']);
      expect(Object.keys(operations.serving).sort()).toEqual(['no', 'yes']);
      expect(operations.servingNote.length).toBeGreaterThan(40);
    });
  });

  it('the Polish provider labels are genuinely Polish, not English copied across', () => {
    (['REAL', 'MOCK', 'UNKNOWN'] as const).forEach((kind) => {
      expect(adminPl.screens.operations.providerKinds[kind]).not.toBe(
        adminEn.screens.operations.providerKinds[kind],
      );
    });
  });
});

describe('G4-5 — ingestion liveness renders honestly', () => {
  it('an unreadable aggregate renders UNAVAILABLE rather than a zero', () => {
    const source = stripComments(SYSTEM_HEALTH);

    expect(source).toContain('if (!ingestion) return UNAVAILABLE;');
    // A real zero still reaches fromOptionalNumber, which maps it to the
    // 'zero' state — a measured zero and an absent source stay distinct.
    expect(source).toContain('fromOptionalNumber(ingestion.articleCount)');
    expect(source).toContain('fromOptionalString(ingestion.latestFetchedAt)');
  });

  it('a loading or failed request never renders an ingestion value', () => {
    const source = stripComments(SYSTEM_HEALTH);

    expect(source).toContain("if (state !== 'real' && state !== 'zero') return { state };");
  });

  it('the ingestion panel names articles and never users in either language', () => {
    [adminEn, adminPl].forEach((dictionary) => {
      const screen = dictionary.screens.systemHealth;
      const text = [
        screen.ingestionTitle,
        screen.ingestionNote,
        screen.ingestionCountLabel,
        screen.ingestionLatestLabel,
      ]
        .join(' ')
        .toLowerCase();

      // The note may say which data is NOT read; what matters is that no
      // label promises a user-shaped figure.
      expect(screen.ingestionCountLabel.toLowerCase()).not.toMatch(
        /user|użytkownik|session|sesj|search|wyszuk/,
      );
      expect(screen.ingestionLatestLabel.toLowerCase()).not.toMatch(
        /user|użytkownik|session|sesj|search|wyszuk/,
      );
      expect(text).toMatch(/article|artyku/);
    });
  });
});

describe('G4-1 / G4-2 — configuration probes say what they are', () => {
  it('both languages explain that the missing OAuth credential is not named', () => {
    expect(adminEn.screens.systemHealth.details['oauth-not-configured']).toMatch(/not reported/i);
    expect(adminPl.screens.systemHealth.details['oauth-not-configured']).toMatch(/celowo/i);
  });

  it('the mock-analysis detail never describes itself as healthy or acceptable in production', () => {
    const en = adminEn.screens.systemHealth.details['ai-provider-mock-active'].toLowerCase();

    expect(en).toContain('synthetic');
    expect(en).toContain('never for production');
    expect(en).not.toContain('healthy');
  });

  it('no probe label promises a live provider call', () => {
    (['ai-provider-configured', 'ai-provider-mock-active'] as const).forEach((key) => {
      expect(adminEn.screens.systemHealth.details[key].toLowerCase()).not.toMatch(
        /respond(ed|ing)|reachable|pinged/,
      );
    });
  });
});

/**
 * A-1 — A FAILED PROVIDER READ MUST NOT READ AS AN ABSENT CAPABILITY.
 *
 * The news provider table used to pass `aiProvidersRequirement` as its empty
 * copy — text about the AI ANALYSIS provider, asserting that no such
 * capability exists — and `AdminDataTable` rendered that same copy for the
 * `error` state. A failed `GET /admin/news/providers` therefore told the
 * reader a working capability was missing.
 *
 * Every assertion below runs against `stripComments(OPERATIONS)`. The source
 * comments explaining this repair necessarily quote the very identifiers
 * these tests forbid, and a checker that matched its own explanation would
 * report success for the wrong reason.
 */
describe('A-1 — the news provider table separates failure from absence', () => {
  const code = stripComments(OPERATIONS);

  it('the AI-provider requirement text no longer appears under the NEWS provider table', () => {
    const table = code.slice(code.indexOf('<AdminDataTable<AdminProviderHealth>'));
    expect(table).not.toContain('aiProvidersRequirement');
  });

  it('but that text SURVIVES where it is correct — the AI providers surface', () => {
    // Half a repair is a regression: the wrong use had to go without taking
    // the right one with it.
    expect(code).toContain('screen.aiProvidersRequirement');
    const aiTab = code.slice(code.indexOf("tab === 'providers'"));
    expect(aiTab).toContain('aiProvidersRequirement');
  });

  it('the empty copy describes a READING, never a missing capability', () => {
    expect(code).toContain('screen.providerHealthEmptyTitle');
    expect(code).toContain('screen.providerHealthEmptyBody');

    const body = adminEn.screens.operations.providerHealthEmptyBody.toLowerCase();
    expect(body).toContain('the request succeeded');
    // The vocabulary of capability absence must not appear in a copy that is
    // shown after a SUCCESSFUL request.
    expect(body).not.toMatch(/requires|none exists|not implemented/);
  });

  it('retry is wired to the resource’s own reload, not to a page refresh', () => {
    expect(code).toContain('onRetry={resource.reload}');
    expect(code).not.toMatch(/location\.reload|window\.location/);
  });

  it('the empty title is distinct from the failure wording the shared renderer shows', () => {
    // AdminDataTable now renders AdminStateBlock on error, which uses
    // states.failed / states.errorNote. Those must not collide with the empty
    // state, or the two outcomes would read alike again.
    expect(adminEn.screens.operations.providerHealthEmptyTitle).not.toEqual(adminEn.states.failed);
    expect(adminEn.screens.operations.providerHealthEmptyBody).not.toEqual(
      adminEn.states.errorNote,
    );
  });

  it('both languages carry the new copy, and the Polish is genuinely translated', () => {
    for (const key of ['providerHealthEmptyTitle', 'providerHealthEmptyBody'] as const) {
      expect(adminEn.screens.operations[key].length).toBeGreaterThan(0);
      expect(adminPl.screens.operations[key].length).toBeGreaterThan(0);
      expect(adminPl.screens.operations[key]).not.toEqual(adminEn.screens.operations[key]);
    }
  });

  it('introduces no sample data — the repair adds copy and branches, never a value', () => {
    // No provider name, count, identifier or timestamp may enter through this
    // change. The empty and error paths render no row at all.
    for (const key of ['providerHealthEmptyTitle', 'providerHealthEmptyBody'] as const) {
      expect(adminEn.screens.operations[key]).not.toMatch(/\d/);
      expect(adminPl.screens.operations[key]).not.toMatch(/\d/);
    }
  });
});

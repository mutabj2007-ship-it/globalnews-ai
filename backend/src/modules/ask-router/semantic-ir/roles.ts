import {
  BETWEEN,
  COMPARISON,
  NAMED_CORRIDOR,
  OBJECT_ROLE,
  domainOf,
  relationKindsIn,
  twoActorEventKinds,
  type BilateralRelationship,
  type EntityRole,
  type RelationKind,
} from '../bilateral-relationship';
import { plTolerant } from '../pl-tolerant';
import type { EntityCandidate } from './entities';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEMANTIC IR §11–§14 — STAGE B: ROLES AND RELATION ARGUMENTS (never identity)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Stage A resolved WHO each place is. Stage B decides what each place DOES in the turn, from the
 * grammar that joins them — never from adjacency alone, never by changing an identity:
 *
 *   COMBINED_ADJECTIVE  "Franco-German", "polsko-litewskie"
 *   BETWEEN             "between A and B", "między A a B"
 *   PREDICATE           a two-place predicate: "Japan accuses China", "Argentina pressed its claim
 *                       against the UK", "Japonia zarzuca Chinom", "Rosja nałożyła sankcje na…"
 *   COMITATIVE          "Canada's trade with Mexico", "współpraca Kanady z Meksykiem", "rozmowy
 *                       Indii z Pakistanem"
 *   COORDINATION        "A and B" / "A i B" / "A–B" joined by an event / relation, or governed by
 *                       "with" / "of" ("what's going on with the US and Venezuela")
 *   PAIR_IN_TURN        exactly two states and a relation word (the landed reading)
 *
 * The other places get roles from their own preposition: a DISPUTED_OBJECT ("over the
 * Falklands", "o Cypr"), a CORRIDOR ("via Rusumo"), a VENUE ("talks in Doha", "w Taszkencie"), else
 * a LOCATION. INVARIANT (§12): a CITY is never an ACTOR or COUNTERPART, and a city's country is
 * never promoted into one. A role never changes a canonical identity. Pure: no I/O, no model.
 */
export type IrEntityRole = EntityRole | 'SCOPE';
export type RelationBasis =
  | 'COMBINED_ADJECTIVE'
  | 'BETWEEN'
  | 'PREDICATE'
  | 'COMITATIVE'
  | 'COORDINATION'
  | 'PAIR_IN_TURN'
  | 'SEMANTIC';
export type RoleConflict = 'GEO_ROLES_UNRESOLVED' | 'RELATION_ROLES_UNCLEAR';

export interface RoledEntity extends EntityCandidate {
  readonly role: IrEntityRole;
}

export interface RelationStructure {
  /** entity ids (Stage A canonical ids) */
  readonly actorA: string;
  readonly actorB: string;
  readonly relations: readonly RelationKind[];
  readonly object: string | null;
  readonly venue: string | null;
  readonly corridor: string | null;
  readonly basis: RelationBasis;
}

export interface RoleAssignment {
  readonly entities: readonly RoledEntity[];
  readonly relationship: RelationStructure | null;
  readonly conflicts: readonly RoleConflict[];
  /**
   * HARDENING §3 — two states joined in one clause by words no reader knows ("Japan rebuked
   * China") and no recoverable structure: whether they are actors of a relation is NOT
   * established (routing-material: the relationship / per-side evidence depends on it).
   */
  readonly rolesIncomplete: boolean;
}

type Lang = 'en' | 'pl';

/* function words only between two states: no unknown predicate there */
const FUNCTION_GAP: Readonly<Record<Lang, RegExp>> = {
  en: /^\s*(?:(?:to|from|in|of|for|with|via|and|or|than|vs\.?|versus|the|a|an|at|on|into|between|by|as|like|nor|both|either|neither|plus|over|about|across|through|against|toward|towards|after|before|since|during)\s+)*$/i,
  pl: /^\s*(?:(?:i|a|z|ze|do|w|we|na|oraz|lub|albo|czy|od|przez|dla|niż|jak|po|o|nad|pod|między|pomiędzy|wobec)\s+)*$/iu,
};
const COMPARATIVE_GAP =
  /\b\p{L}+er\s+than\b|\b(?:more|less)\s+\p{L}+\s+than\b|(?:^|\s)(?:niż|bardziej|mniej)(?![\p{L}])/iu;

const COORDINATOR = /^\s*(?:,\s*)?(?:and|&|-|\/|vs\.?|versus|i|a|oraz)\s*(?:the\s+)?$/iu;
const BETWEEN_BEFORE = plTolerant(
  /(?:\b(?:between|among|linking|connecting)|(?:^|\s)(?:między|pomiędzy|łącząc\p{L}*))\s+(?:the\s+)?$/iu,
);
/* a coordinated pair governed by "with" / "of" / "for": the pair is ONE object of the clause */
const GOVERNED_PAIR_BEFORE = plTolerant(
  /(?:\b(?:with|of|for|on|about)|(?:^|\s)(?:z|ze|o|dla|między))\s+(?:the\s+)?$/iu,
);

/* two-place predicates (the actor is the subject, the counterpart the object) */
const EN_PREDICATE = new RegExp(
  String.raw`^\s*(?:['’]s\s+)?(?:(?:has|have|had|is|are|was|were|will|would|did|does|do|could|may|might|been|keeps?|continues?\s+to|still|again|now|just|officially|formally|reportedly|repeatedly|recently|openly|publicly|not|never|also)\s+){0,3}` +
    String.raw`(?:(?:accus|blam|condemn|criticis|criticiz|warn|threaten|sanction|embargo|boycott|invad|attack|bomb|strik|occup|annex|expel|recogni[sz]|defeat|support|back|arm|fund|ban|pressur|snub|spy|hack|provok|retaliat|mediat|host)\w*(?:\s+(?:[\p{L}'’-]+\s+){0,3}?(?:over|for|of|on|with|against))?` +
    String.raw`|su(?:e|ed|es|ing)|(?:struck|beat|beats|fought|fight\w*|clash\w*|negotiat\w*|trad\w*|ally\w*|allied|compet\w*|disput\w*|quarrel\w*|feud\w*|border\w*|cooperat\w*|partner\w*|reconcil\w*|talk\w*|met|meet\w*|sign\w*\s+(?:[\p{L}-]+\s+){0,3}?with|split\s+from|broke\s+(?:away\s+)?from|seceded\s+from|separated\s+from|gained\s+independence\s+from|declared\s+war\s+on|went\s+to\s+war\s+with|(?:at\s+)?war\s+with)(?:\s+(?:with|against))?` +
    String.raw`|(?:press\w*|brought|bring\w*|fil\w*|lodg\w*|mak\w*|made|renew\w*|assert\w*|reassert\w*|push\w*|drop\w*)\s+(?:[\p{L}'’-]+\s+){0,3}?(?:claims?|case|complaint|suit|lawsuit|demands?|grievances?)\s+(?:against|on|to|with)` +
    String.raw`|(?:impos|levi|slapp?)\w*\s+(?:[\p{L}'’-]+\s+){0,3}?(?:on|against)` +
    String.raw`|(?:[\p{L}'’-]+\s+){0,4}?against)\s+(?:the\s+)?$`,
  'iu',
);
const PL_PREDICATE = plTolerant(
  /^\s*(?:(?:już|nadal|wciąż|ponownie|oficjalnie|znowu|nie|się)\s+){0,2}(?:zarzuca\p{L}*|oskarż\p{L}*|obwinia\p{L}*|potępi\p{L}*|krytykuj\p{L}*|skrytykował\p{L}*|ostrzega\p{L}*|ostrzegł\p{L}*|grozi\p{L}*|zagroził\p{L}*|atakuj\p{L}*|zaatakował\p{L}*|najechał\p{L}*\s+na|napadł\p{L}*\s+na|okupuj\p{L}*|anektował\p{L}*|uznał\p{L}*|uznaje|pozwał\p{L}*|pozywa|wspiera\p{L}*|wsparł\p{L}*|pokonał\p{L}*|(?:nałożył\p{L}*|nakłada\p{L}*)\s+(?:\p{L}+\s+){0,2}?na|negocjuj\p{L}*\s+z|negocjował\p{L}*\s+z|handluj\p{L}*\s+z|walczy\p{L}*\s+z|walczył\p{L}*\s+z|wojuj\p{L}*\s+z|wojował\p{L}*\s+z|spiera\p{L}*\s+się\s+z|ściera\p{L}*\s+się\s+z|rywalizuj\p{L}*\s+z|graniczy\s+z|współpracuj\p{L}*\s+z|podpisał\p{L}*\s+(?:\p{L}+\s+){0,2}?z|zawarł\p{L}*\s+(?:\p{L}+\s+){0,2}?z|ma\s+(?:pretensj\p{L}*|roszczeni\p{L}*)\s+(?:\p{L}+\s+){0,2}?(?:do|wobec)|(?:\p{L}+\s+){0,3}?(?:przeciwko|przeciw|wobec))\s*$/iu,
);
const PREDICATE_KIND: ReadonlyArray<readonly [RegExp, RelationKind]> = [
  [/sanction|embargo|boycott|tariff|impos|levi|slap|sankcj|nał|nakłada|cł/iu, 'ECONOMIC'],
  [
    /invad|attack|bomb|strik|struck|occup|fought|fight|war\b|wojn|wojuj|wojow|atak|najech|napad|okup|walcz/iu,
    'WAR',
  ],
  [/claim|annex|roszcz|anekt/iu, 'TERRITORIAL_DISPUTE'],
  [/trad|handl/iu, 'TRADE'],
  [/ally|allied|support|back|arm\b|fund|wspiera|wsparł/iu, 'ALLIANCE'],
  [/compet|defeat|beat|rywaliz|pokonał/iu, 'COMPETITION'],
];
const EN_COMITATIVE = /^\s*(?:['’]s)?\s+(?:[\p{L}-]+\s+){0,3}?with\s+(?:the\s+)?$/iu;
const PL_COMITATIVE = /^\s*(?:z|ze)\s+$/iu;

const VENUE_IN = plTolerant(/(?:\b(?:in|at)|(?:^|\s)(?:w|we))\s+(?:the\s+)?$/iu);

function predicateKinds(between: string): RelationKind[] {
  return PREDICATE_KIND.filter(([re]) => re.test(between)).map(([, k]) => k);
}

interface Structure {
  readonly a: EntityCandidate;
  readonly b: EntityCandidate;
  readonly basis: RelationBasis;
  readonly kinds: readonly RelationKind[];
}

/** STAGE B — roles for every Stage A candidate, and the relation's arguments when there is one. */
export function assignRoles(
  text: string,
  language: string,
  candidates: readonly EntityCandidate[],
): RoleAssignment {
  const lang: Lang = language === 'pl' ? 'pl' : 'en';
  const states = candidates.filter((c) => c.type === 'COUNTRY');
  /* a relation word never comes from INSIDE a place name ("Portugal" is not a port): the
     vocabulary is read with every resolved entity span masked */
  const masked = candidates.reduce(
    (t, c) => t.slice(0, c.start) + ' '.repeat(c.end - c.start) + t.slice(c.end),
    text,
  );
  const relationWords = relationKindsIn(masked);
  const eventKinds = twoActorEventKinds(masked);
  const conflicts: RoleConflict[] = [];

  /* the actor structure, by grammar (strongest first) */
  const found: Structure[] = [];
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      const a = states[i];
      const b = states[j];
      if (a.iso3 === b.iso3) continue;
      const between = text.slice(a.end, b.start);
      const before = text.slice(Math.max(0, a.start - 40), a.start);
      if (a.basis === 'COMBINED_ADJECTIVE' && b.basis === 'COMBINED_ADJECTIVE' && between === '-') {
        found.push({ a, b, basis: 'COMBINED_ADJECTIVE', kinds: [] });
        continue;
      }
      if (COORDINATOR.test(between) && BETWEEN_BEFORE.test(before)) {
        found.push({ a, b, basis: 'BETWEEN', kinds: [] });
        continue;
      }
      const predicate = (lang === 'pl' ? PL_PREDICATE : EN_PREDICATE).exec(between);
      if (predicate !== null && between.length <= 90) {
        found.push({ a, b, basis: 'PREDICATE', kinds: predicateKinds(between) });
        continue;
      }
      if (
        (lang === 'pl' ? PL_COMITATIVE : EN_COMITATIVE).test(between) &&
        (relationWords.length > 0 || eventKinds.length > 0)
      ) {
        found.push({ a, b, basis: 'COMITATIVE', kinds: [] });
        continue;
      }
      if (
        COORDINATOR.test(between) &&
        (relationWords.length > 0 || eventKinds.length > 0 || GOVERNED_PAIR_BEFORE.test(before))
      )
        found.push({ a, b, basis: 'COORDINATION', kinds: [] });
    }
  }
  const order: readonly RelationBasis[] = [
    'COMBINED_ADJECTIVE',
    'BETWEEN',
    'PREDICATE',
    'COMITATIVE',
    'COORDINATION',
  ];
  let structure: Structure | null =
    [...found].sort((x, y) => order.indexOf(x.basis) - order.indexOf(y.basis))[0] ?? null;
  const distinctStates = [...new Set(states.map((s) => s.iso3))];
  if (
    structure === null &&
    distinctStates.length === 2 &&
    (relationWords.length > 0 || eventKinds.length > 0)
  ) {
    const a = states.find((s) => s.iso3 === distinctStates[0])!;
    const b = states.find((s) => s.iso3 === distinctStates[1])!;
    structure = { a, b, basis: 'PAIR_IN_TURN', kinds: [] };
  }
  /* A comparison is two subjects side by side, not what passes between them — unless the grammar
     itself joins them (between / a combined adjective / a predicate) */
  if (
    structure !== null &&
    COMPARISON.test(text) &&
    !BETWEEN.test(text) &&
    !['BETWEEN', 'COMBINED_ADJECTIVE', 'PREDICATE'].includes(structure.basis)
  )
    structure = null;
  /* three or more states, relation vocabulary, and no grammatical structure naming two actors */
  if (
    structure === null &&
    distinctStates.length >= 3 &&
    (relationWords.length > 0 || eventKinds.length > 0) &&
    /* the members of a comparison are COMPARISON_MEMBERs, never a role conflict */
    !COMPARISON.test(text)
  )
    conflicts.push('GEO_ROLES_UNRESOLVED');
  /* a relation predicate with two states but no recoverable argument structure */
  if (
    structure === null &&
    distinctStates.length >= 2 &&
    (lang === 'pl' ? /(?:zarzuca|oskarż|sankcj|przeciw)/iu : /\b(?:accus|sanction|against)/i).test(
      text,
    )
  )
    conflicts.push('RELATION_ROLES_UNCLEAR');

  const relations: RelationKind[] =
    structure === null ? [] : [...new Set([...relationWords, ...eventKinds, ...structure.kinds])];
  const actorIds = structure === null ? [] : [structure.a.id, structure.b.id];

  const roled: RoledEntity[] = candidates.map((c) => {
    if (structure !== null && c === structure.a) return { ...c, role: 'ACTOR' };
    if (structure !== null && c === structure.b) return { ...c, role: 'COUNTERPART' };
    /* the same country named twice keeps its actor role */
    if (structure !== null && actorIds.includes(c.id))
      return { ...c, role: c.id === structure.a.id ? 'ACTOR' : 'COUNTERPART' };
    const before = text.slice(Math.max(0, c.start - 40), c.start);
    const byPreposition = OBJECT_ROLE.find(([, re]) => re.test(before))?.[0];
    if (c.type === 'CITY' || c.type === 'PLACE') {
      const venue =
        byPreposition === 'VENUE' ||
        (VENUE_IN.test(before) && (eventKinds.length > 0 || structure !== null));
      return {
        ...c,
        role: venue ? 'VENUE' : byPreposition === 'CORRIDOR' ? 'CORRIDOR' : 'LOCATION',
      };
    }
    if (byPreposition !== undefined) return { ...c, role: byPreposition };
    if (c.type === 'TERRITORY' || c.type === 'REGION')
      return {
        ...c,
        role:
          structure !== null &&
          (relations.includes('TERRITORIAL_DISPUTE') || /\b(?:dispute|claim|over)\b/i.test(text))
            ? 'DISPUTED_OBJECT'
            : 'LOCATION',
      };
    if (structure !== null && VENUE_IN.test(before) && eventKinds.length > 0)
      return { ...c, role: 'VENUE' };
    if (structure !== null) {
      /* a third state with no grammatical role: two actors were found, this one is unexplained */
      if (!conflicts.includes('GEO_ROLES_UNRESOLVED')) conflicts.push('GEO_ROLES_UNRESOLVED');
      return { ...c, role: 'LOCATION' };
    }
    return { ...c, role: COMPARISON.test(text) ? 'COMPARISON_MEMBER' : 'SCOPE' };
  });

  const object = roled.find((e) => e.role === 'DISPUTED_OBJECT')?.id ?? null;
  const venue = roled.find((e) => e.role === 'VENUE')?.id ?? null;
  const rolesIncomplete =
    structure === null &&
    !COMPARISON.test(text) &&
    states.some((a, i) => {
      const b = states[i + 1];
      if (b === undefined || a.iso3 === b.iso3) return false;
      const gap = text.slice(a.end, b.start);
      return (
        gap.length <= 60 &&
        /^[\s\p{L}'’-]+$/u.test(gap) &&
        !FUNCTION_GAP[lang].test(gap) &&
        !COMPARATIVE_GAP.test(gap) &&
        !COORDINATOR.test(gap)
      );
    });
  return {
    rolesIncomplete,
    entities: roled,
    relationship:
      structure === null
        ? null
        : {
            actorA: structure.a.id,
            actorB: structure.b.id,
            relations: relations.length === 0 ? ['GENERAL'] : relations,
            object,
            venue,
            corridor: NAMED_CORRIDOR.exec(text)?.[1] ?? null,
            basis: structure.basis,
          },
    conflicts,
  };
}

/** The relationship in the route's (legacy) shape: both ACTORS' ISO3, relation, domain, roles. */
export function toBilateralRelationship(assignment: RoleAssignment): BilateralRelationship | null {
  const rel = assignment.relationship;
  if (rel === null) return null;
  const a = assignment.entities.find((e) => e.id === rel.actorA);
  const b = assignment.entities.find((e) => e.id === rel.actorB);
  if (a?.iso3 == null || b?.iso3 == null) return null;
  const relations = rel.relations.filter((r) => r !== 'GENERAL');
  return {
    countries: [a.iso3, b.iso3],
    relations: rel.relations,
    domain: domainOf(relations),
    corridor: rel.corridor,
    entities: [
      { iso3: a.iso3, role: 'ACTOR' },
      { iso3: b.iso3, role: 'COUNTERPART' },
      ...assignment.entities
        .filter((e) => e.id !== rel.actorA && e.id !== rel.actorB && e.role !== 'SCOPE')
        .map((e) => ({ iso3: e.iso3, role: e.role as EntityRole }))
        .filter((e, i, all) => all.findIndex((x) => x.iso3 === e.iso3 && x.role === e.role) === i),
    ],
  };
}

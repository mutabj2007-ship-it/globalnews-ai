import { plTolerant } from '../pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO RUN-3 RULING §5 — THE PERSISTENCE OF A PRESENT, MUTABLE STATE IS A CURRENT QUESTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ROOT CAUSE (EN/PL reliability rerun, an informal turn about whether a central bank's rate hike
 * "is gonna stick"): nothing in the deterministic reading established currentness, the turn
 * escalated as JOB_UNRESOLVED, and the interpreter's verdict flipped between runs — once "current",
 * once "an opinion" (timeless reasoning). A question of that FORM was left to a stochastic call.
 *
 * INVARIANT: a question whether an already-occurring mutable policy / action / measure / state will
 * continue, hold, stick, last, persist, remain or survive requires current-state evidence — unless
 * the reader's own temporal context makes it explicitly historical (a past tense, a completed
 * period) or hypothetical ("if", "suppose", "would … if"). It is a GOVERNED current FORM (like a
 * current office): the deterministic reading establishes it and the interpreter may not downgrade it.
 *
 * The form needs BOTH parts — a mutable-state / policy / action head and a persistence predicate in
 * the present / future — so "will the universe keep expanding" or "does love last" are not read.
 */
const EN_HEAD = String.raw`(?:rates?|rate\s+(?:hike|cut|rise|increase)s?|hikes?|cuts?|increases?|rises?|policy|policies|measures?|sanctions|tariffs?|duties|ban|bans|embargo|boycott|blockade|ceasefire|truce|deal|agreement|accord|pact|coalition|government|cabinet|alliance|peg|freeze|cap|caps|subsid(?:y|ies)|reforms?|programme|program|lockdown|curfew|restrictions?|controls?|strike|strikes|protests?|rally|surge|boom|slump|recovery|rebound|crackdown|offensive|occupation|truce|regime|moratorium|quota|quotas|devaluation|rule|rules|law|laws|mandate|stimulus|austerity|shutdown|standoff|détente|detente)`;
const EN_PERSIST = String.raw`(?:stick|last|hold(?:\s+up)?|continue|persist|remain(?:\s+in\s+(?:place|force))?|stay(?:\s+in\s+(?:place|force))?|survive|endure|keep\s+going|carry\s+on|be\s+(?:sustained|extended|maintained|kept|reversed|rolled\s+back|lifted)|get\s+(?:reversed|rolled\s+back|lifted)|be\s+here\s+to\s+stay)`;
const EN_FORM = new RegExp(
  String.raw`\b${EN_HEAD}\b(?:['’]s)?[^.?!]{0,40}?\b(?:will|['’]ll|gonna|going\s+to|is\s+(?:likely|expected|set)\s+to|are\s+(?:likely|expected|set)\s+to|can|could)\s+(?:actually\s+|really\s+|still\s+)?${EN_PERSIST}\b|\b(?:will|can|could|is|are)\s+(?:the\s+|this\s+|that\s+|these\s+|their\s+|its\s+|[\p{L}]+['’]s\s+)?(?:[\p{L}-]+\s+){0,3}?${EN_HEAD}\s+(?:actually\s+|really\s+|still\s+)?${EN_PERSIST}\b|\b${EN_HEAD}\b[^.?!]{0,30}?\bhere\s+to\s+stay\b`,
  'iu',
);
const EN_HYPOTHETICAL =
  /\b(?:if|suppose|supposing|hypothetically|imagine|in\s+theory|would\b[^.?!]{0,60}\bif)\b/i;
const EN_PAST =
  /\b(?:did|was|were|had|used\s+to)\b[^.?!]{0,50}\b(?:stick|last|hold|continue|persist|remain|stay|survive|endure)\b/i;

const PL_HEAD = String.raw`(?:podwyżk\p{L}*|obniżk\p{L}*|stop\p{L}*\s+procentow\p{L}*|stop\p{L}*|polityk\p{L}*|sankcj\p{L}*|cł\p{L}*|ceł|zakaz\p{L}*|embarg\p{L}*|rozejm\p{L}*|zawieszeni\p{L}*\s+broni|porozumieni\p{L}*|umow\p{L}*|koalicj\p{L}*|rząd\p{L}*|reform\p{L}*|program\p{L}*|ograniczeni\p{L}*|strajk\p{L}*|protest\p{L}*|blokad\p{L}*|kurs\p{L}*|limit\p{L}*|dopłat\p{L}*|subwencj\p{L}*|przepis\p{L}*|ustaw\p{L}*|lockdown\p{L}*|wzrost\p{L}*|spadk\p{L}*|ożywieni\p{L}*|odbici\p{L}*)`;
const PL_PERSIST = String.raw`(?:(?:się\s+)?utrzyma(?:\s+się)?|przetrwa|potrwa|zostanie(?:\s+utrzyman\p{L}*)?|będzie\s+(?:trwać|trwał\p{L}*|obowiązywać|obowiązywał\p{L}*|utrzymywać|kontynuowan\p{L}*)|nadal\s+będzie|wytrzyma|się\s+nie\s+utrzyma|zostanie\s+(?:odwołan|cofnięt|zniesion|przedłużon)\p{L}*)`;
const PL_FORM = plTolerant(
  new RegExp(
    String.raw`(?<![\p{L}])${PL_HEAD}(?![\p{L}])[^.?!]{0,50}?(?<![\p{L}])${PL_PERSIST}(?![\p{L}])|(?<![\p{L}])${PL_PERSIST}(?![\p{L}])[^.?!]{0,40}?(?<![\p{L}])${PL_HEAD}(?![\p{L}])`,
    'iu',
  ),
);
const PL_HYPOTHETICAL = plTolerant(
  /(?<![\p{L}])(?:gdyby|jeśli|jeżeli|załóżmy|hipotetycznie|przypuśćmy)(?![\p{L}])/iu,
);
const PL_PAST = plTolerant(
  /(?<![\p{L}])(?:utrzymał\p{L}*|przetrwał\p{L}*|potrwał\p{L}*|wytrzymał\p{L}*)(?![\p{L}])/iu,
);

/*
  PRE-FREEZE (sealed #1 regression R4-021 / R4-028): the invariant is about an ALREADY-OCCURRING,
  PARTICULAR policy / action — never a generic one. "a framework for judging whether a coalition is
  likely to hold together", "in general, what signals tell you a ceasefire is likely to last" are
  conceptual. EN: the head must be particular (the / this / that / a possessive / a named entity
  right before it), and no generic frame may govern the clause. PL has no articles: only the
  generic-frame exclusion applies.
*/
const EN_GENERIC =
  /\b(?:in\s+general|generally|typically|usually|in\s+principle|as\s+a\s+rule|historically|what\s+(?:signals?|signs?|factors?|makes?|determines?|decides?)|how\s+(?:do|can|could|would|should)\s+(?:you|we|one|i)\s+(?:judge|tell|assess|know|predict|evaluate)|framework|criteria|indicators?)\b/i;
const EN_PARTICULAR_DET =
  /(?:^|\s)(?:the|this|that|these|those|its|their|his|her|our|[\p{L}.-]+['’]s)\s+(?:[\p{L}.-]+\s+){0,3}$/iu;
const EN_HEAD_RE = new RegExp(String.raw`\b${EN_HEAD}\b`, 'iu');
const EN_NOT_NAME =
  /^(?:Will|Is|Are|Can|Could|Do|Does|Did|Would|Should|How|What|Why|When|Where|Who|Which|U|I)$/;
const PL_GENERIC = plTolerant(
  /(?<![\p{L}])(?:ogólnie|zazwyczaj|zwykle|w\s+ogóle|z\s+reguły|co\s+decyduje|jakie\s+(?:sygnały|czynniki|oznaki)|po\s+czym\s+poznać|kryteri\p{L}*|ramy)(?![\p{L}])/iu,
);

function particularHead(clause: string, match: RegExpExecArray): boolean {
  const head = EN_HEAD_RE.exec(match[0]);
  if (head === null) return false;
  const before = clause.slice(0, match.index + head.index);
  if (EN_PARTICULAR_DET.test(before)) return true;
  /* a named entity right before the head ("ECB rate cut", "Fed hike") — case-sensitive */
  const words = before.trim().split(/\s+/).slice(-3);
  return words.some((w) => /^\p{Lu}[\p{L}.-]*$/u.test(w) && !EN_NOT_NAME.test(w));
}

/** The persistence-of-a-present-mutable-state question form (EN / PL), or null. */
export function readPersistenceQuestion(clause: string, language: string): string | null {
  if (language === 'en') {
    if (EN_HYPOTHETICAL.test(clause) || EN_PAST.test(clause) || EN_GENERIC.test(clause))
      return null;
    const m = EN_FORM.exec(clause);
    return m !== null && particularHead(clause, m) ? m[0] : null;
  }
  if (language === 'pl') {
    if (PL_HYPOTHETICAL.test(clause) || PL_PAST.test(clause) || PL_GENERIC.test(clause))
      return null;
    return PL_FORM.exec(clause)?.[0] ?? null;
  }
  return null;
}

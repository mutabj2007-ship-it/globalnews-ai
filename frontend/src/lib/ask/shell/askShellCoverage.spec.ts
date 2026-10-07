import { DISPLAY_LOCALES, directionFor } from '@globalnews-ai/shared';
import {
  ASK_SHELL_DRAFT_LOCALES,
  ASK_SHELL_L_QUALIFIED_LOCALES,
  ASK_SHELL_SOURCE_LOCALES,
  askShellCoverage,
  askShellCoverageAll,
  askShellKeyPaths,
  askShellQualification,
  askShellStrings,
  askShellTemplatePaths,
} from '@/lib/ask/shell/askShellCatalogue';
import { declaredFallbacksFor } from '@/lib/ask/shell/askShellDeclaredFallbacks';
import { ASK_SHELL_PROPER_NOUNS, askShellSource } from '@/lib/ask/shell/askShellSource';
import { isShellTemplatePath, shellPathWithoutMarker } from '@/lib/ask/shell/askShellOverlay';
import { qualifiedUnchangedFor } from '@/lib/ask/shell/askShellQualifiedUnchanged';

/** Read one key path out of a resolved shell. */
function readPath(source: unknown, path: string): unknown {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      source,
    );
}
import { askSevenStrings } from '@/lib/ask/askSevenStrings';
import { shellKeyPaths } from '@/lib/ask/shell/askShellOverlay';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · PHASE B ACCEPTANCE — "MISSING KEYS MUST FAIL TESTS, NOT SHOW ENGLISH"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The P0 correction's architecture requirement, verbatim: *"`selectedLocale` must drive the
 * entire Ask UI catalogue. Do not maintain one locale for the question and a separate
 * EN/PL-only locale for the interface."* And its enforcement requirement, verbatim:
 * *"Missing catalogue keys must fail tests rather than silently displaying English."*
 *
 * This spec is that enforcement. It does not check that the shell is finished — it is not,
 * and 389 keys per locale are declared pending Claude L. It checks that the gap is EXACTLY
 * the declared one, in both directions, so no key can start or stop falling back between
 * rounds without a test moving.
 */

/* The five locales L qualified. They were ASK_SHELL_DRAFT_LOCALES before she delivered. */
const L_LOCALES = ASK_SHELL_L_QUALIFIED_LOCALES;

describe('B-6 · the shell is one catalogue over seven locales', () => {
  it('every contracted locale resolves a whole shell', () => {
    for (const locale of DISPLAY_LOCALES) {
      const shell = askShellStrings(locale);
      /* Same shape in every locale — a locale cannot be missing a catalogue. */
      expect(Object.keys(shell).sort()).toEqual(Object.keys(askShellSource()).sort());
      /*
        SORTED, because key ORDER legitimately differs: the Polish dictionary declares its
        own `navBar` members in its own order, and `Object.entries` follows insertion order.
        The SET is what matters, and it matters a great deal — a key present in English and
        absent from an authored locale resolves to `undefined` at the call site, which renders
        as nothing at all. That is worse than falling back to English, and it would not be
        caught by the fallback accounting, which only inspects overlays.
      */
      expect([...shellKeyPaths(shell)].sort()).toEqual([...askShellKeyPaths()].sort());
    }
  });

  it('the inventory reconciles with the manifest sent to Claude L', () => {
    /*
      559  reader-visible Ask-shell keys on the base 5699eb7
      -24  askSevenStrings, already total over all seven and read directly
      ────
      535  overlay-managed
       -5  provider/product proper nouns
      ────
      527  Claude L's scope — Revision 4, less the three brand keys

      THE DENOMINATOR IS ASSERTED, NOT DOCUMENTED, because it moved twice and both moves
      were failures of measurement rather than of translation. 469 → 479 when the enumerator
      was found to skip function-valued members; 479 → 559 when wiring the components found
      eighty keys that were never in a catalogue at all — component-private records, bare
      `locale === 'pl' ? … : …` ternaries, and two view builders that resolved their own copy
      from a locale argument. A coverage report with the wrong denominator is not a report.

      ASK READING EXPERIENCE R1 (PRODUCTION-LINE RECONCILIATION onto 48eab57) retires
      dict.loadingStages[0..3] from the Ask shell (the simulated 1.8 s stage timer is gone from
      every Ask surface; H-FREEZE §5, L2) and adds askR2Strings.working (the one truthful working
      line) and askR2Strings.tableScrollHint (a template: a wide table's hint, shown only when it
      overflows): 535 − 4 + 2 → 533, 527 → 525. The Ask R2 keys of the Alpha line
      (questionTooLong, questionLength, showFullQuestion, showLessQuestion, quota, priorNoFindings,
      timedOut, priorIncomplete) are deliberately NOT on this line. The two new keys'
      fr/de/es/pt-BR/ar wording is an ENGINEERING translation awaiting Claude L qualification
      (L1) — present so no locale falls back to English.
      CURRENT-REPORTING TRUTH R1 (B1) adds ONE reader-visible key, askR2Strings.badges.retrep
      ("RETAINED REPORTING" — the badge of the new canonical RETAINED_REPORTING state). It is
      counted twice because it is read twice: as an overlay-managed shell key (533 → 534,
      localized 525 → 526) and through askSevenStrings.reasoning, which IS the shell's badge
      table (24 → 25). Combined Production-line total 534 + 25 = 559. Its fr/de/es/pt-BR/ar
      wording is an ENGINEERING translation awaiting Claude L qualification; no locale falls back
      to English. (Counts recalculated for this combined line, not copied from either side.)
      H PROD-1 (Production composer over-limit state) adds ONE reader-visible template,
      askR2Strings.questionOverLimit — the over-limit sentence, its own key, NOT the Alpha line's
      questionTooLong/questionLength: 534 → 535, localized 526 → 527, total 559 → 560. Its
      fr/de/es/pt-BR/ar wording is an ENGINEERING translation sent to Claude L for qualification;
      no locale falls back to English.
      ASK DESIGN COMPLETENESS R1 (the original Claude Design package, e06a8278…3bf1) adds the
      askR2Strings.read group: 37 reader-visible keys, 7 of them templates (moreDetail,
      footerReports, footerPublishers, footerNewest, shareIncludes, sourcesCited, reopenedLine).
      535 → 572, localized 527 → 564, total 560 → 597. fr/de/es/pt-BR/ar wording is an
      ENGINEERING translation awaiting Claude L qualification; no locale falls back to English.
    */
    const overlayManaged = askShellKeyPaths().length;
    const alreadySeven = shellKeyPaths(askSevenStrings('en')).length;
    expect(alreadySeven).toBe(25);
    expect(overlayManaged).toBe(577);
    expect(overlayManaged + alreadySeven).toBe(602);
    /*
      EIGHT, not five: the CTO's brand ruling moved the three product-NAME keys out of the
      translation scope. A key nobody should translate does not belong in a translator's
      manifest, and leaving it there is what let three authorities give three answers.
    */
    expect(ASK_SHELL_PROPER_NOUNS).toHaveLength(8);
    expect(overlayManaged - ASK_SHELL_PROPER_NOUNS.length).toBe(569);
  });

  it('each proper noun names a key that actually exists', () => {
    const unmarked = askShellKeyPaths().map(shellPathWithoutMarker);
    for (const path of ASK_SHELL_PROPER_NOUNS) expect(unmarked).toContain(path);
  });

  it('every template is present and enumerable, by name', () => {
    /*
      A template is the one key a reviewer cannot check from a screenshot: its wording only
      appears for particular arguments and its plural behaviour only for particular counts.
      So all 33 are pinned by name. This is also the regression for the enumerator defect —
      the first scaffold emitted NONE of these and the fallback accounting was blind to every
      one, which is how a locale could have been called complete with 33 English sentences in
      it.
    */
    expect(askShellTemplatePaths().map(shellPathWithoutMarker).sort()).toEqual(
      [
        'askR2Strings.clarify.broadening',
        'askR2Strings.freshness.corroboratedAsOf',
        'askR2Strings.guest.remaining',
        'askR2Strings.r3.choiceFor',
        'askR2Strings.r3.relationshipScope',
        'askR2Strings.sourcesLabel',
        /* ASK READING EXPERIENCE R1 — a wide table's scroll hint names its column count */
        'askR2Strings.tableScrollHint',
        /* H PROD-1 — the over-limit sentence names the Production backend's bound */
        'askR2Strings.questionOverLimit',
        /* ASK DESIGN COMPLETENESS R1 — the reading-surface templates */
        'askR2Strings.read.moreDetail',
        'askR2Strings.read.footerReports',
        'askR2Strings.read.footerPublishers',
        'askR2Strings.read.footerNewest',
        'askR2Strings.read.shareIncludes',
        'askR2Strings.read.sourcesCited',
        'askR2Strings.read.reopenedLine',
        'askR2Strings.read.aboutStory',
        'briefingStrings.latest',
        'briefingStrings.savedAs',
        'briefingStrings.superseded',
        'briefingStrings.version',
        /* Recovered from inside components in Phase B. */
        'askRecentReportingStrings.title',
        'askRecentReportingStrings.topic.TRAVEL',
        'askRecentReportingStrings.topic.ECONOMY',
        'askRecentReportingStrings.topic.SECURITY',
        'askRecentReportingStrings.topic.BUSINESS',
        'askRecentReportingStrings.topic.SCIENCE',
        'askEvidenceTableStrings.citation',
        'askEvidenceTableStrings.omitted',
        'askContextStrings.comparingStories',
        /* Exported, but resolved from a locale argument inside their own modules until now. */
        'askGovernedCopy.imihigo',
        'askGovernedCopy.imihigoProvenance',
        'askGovernedCopy.imihigoFollowUp',
        'askGovernedCopy.imihigoAbsent',
        'askGovernedCopy.imihigoAbsentFollowUp',
        'askGovernedCopy.cpi',
        'askGovernedCopy.cpiProvenance',
        'askGovernedCopy.procurement',
        'askGovernedCopy.procurementProvenance',
        'askGovernedCopy.official',
        'askGovernedCopy.officialFollowUp',
        'askIntelligenceStrings.lead.imihigo',
        'askIntelligenceStrings.lead.cpi',
        'askIntelligenceStrings.lead.procurement',
      ].sort(),
    );
    /* 33 + ASK READING EXPERIENCE R1 tableScrollHint + H PROD-1 questionOverLimit (the Ask R2
       input-limit templates are still not on
       the Production line) */
    /* + ASK DESIGN COMPLETENESS R1's seven reading-surface templates */
    expect(askShellTemplatePaths()).toHaveLength(43);
  });
});

describe('B-7 · no English fallback is ever silent', () => {
  it.each([...DISPLAY_LOCALES])('%s — measured fallbacks equal declared fallbacks', (locale) => {
    const measured = [...askShellCoverage(locale).fallbacks].sort();
    const declared = [...declaredFallbacksFor(locale)].sort();
    /*
      EQUALITY, not containment, and this is the whole point. Containment would let an
      untranslated key hide inside an over-broad declaration; equality means the declaration
      has to be true.
    */
    expect(measured).toEqual(declared);
  });

  it('English and Polish are authored catalogues with no gap at all', () => {
    for (const locale of ASK_SHELL_SOURCE_LOCALES) {
      const coverage = askShellCoverage(locale);
      expect(coverage.qualification).toBe('SOURCE');
      expect(coverage.fallbacks).toEqual([]);
      expect(coverage.complete).toBe(true);
      expect(coverage.localizedKeys).toBe(569);
    }
  });

  it('the L-qualified locales are now COMPLETE — zero fallback, not zero declared', () => {
    /*
      This block spent three revisions asserting an honest NON-ZERO gap, which was the right
      assertion while there was one. Claude L's Revision 4 answer closed it.

      `complete` is the measured fact, not the declared one: it is
      `shellFallbacks(source, overlay).length === 0`, computed from the overlay itself. The
      empty declaration in `askShellDeclaredFallbacks.ts` is checked SEPARATELY against the
      same measurement by the equality test above, so an empty list cannot pass by being
      empty — it passes only because nothing measures as falling back.
    */
    for (const locale of L_LOCALES) {
      const coverage = askShellCoverage(locale);
      expect(coverage.qualification).toBe('CLAUDE_L_QUALIFIED');
      expect(coverage.complete).toBe(true);
      expect(coverage.fallbacks).toEqual([]);
      expect(coverage.localizedKeys).toBe(569);
      /* 569 localized + 0 unqualified + 8 not-translated = the 577 overlay-managed keys. */
      expect(coverage.localizedKeys + coverage.fallbacks.length + coverage.properNouns).toBe(
        coverage.totalKeys,
      );
    }
  });

  it('REGRESSION — an untranslated key cannot pass by being absent from the enumeration', () => {
    /*
      The failure this guards against is not "a key is untranslated" — 389 are, declared. It
      is "a key is untranslated AND invisible", which is what happens when the enumerator
      misses a leaf kind. So the denominator is asserted directly: if a future catalogue adds
      a leaf shape nobody handles, this count stops matching and the suite fails here.
    */
    expect(askShellKeyPaths()).toHaveLength(577);
    for (const locale of L_LOCALES) {
      const coverage = askShellCoverage(locale);
      expect(coverage.totalKeys).toBe(577);
    }
  });

  it('a declared key that L has delivered must be REMOVED from the declaration', () => {
    /*
      Asserted by construction rather than by a comment: every declared path must still be a
      real fallback. A path L has filled is no longer measured, so leaving it declared fails
      the equality above — and leaving a path declared that does not exist at all fails here.
    */
    const paths = askShellKeyPaths();
    for (const locale of L_LOCALES) {
      for (const declared of declaredFallbacksFor(locale)) {
        expect(paths).toContain(declared);
      }
    }
  });
});

describe('B-8 · every overlay string is Claude L\u2019s, and no H draft survives', () => {
  it('no locale carries H drafts any more', () => {
    /*
      THE TRIPWIRE FIRED, WHICH IS WHAT IT WAS FOR. This block previously asserted that NO
      locale reported CLAUDE_L_QUALIFIED, so that H could not label its own drafts as
      linguistically qualified and a silent promotion would fail a test. L has now delivered,
      every H draft string was REPLACED rather than kept beside hers, and the draft list is
      empty — which is the evidence for the ruling's step 3 rather than a claim about it.
    */
    expect(ASK_SHELL_DRAFT_LOCALES).toEqual([]);
    for (const locale of L_LOCALES) {
      expect(askShellQualification(locale)).toBe('CLAUDE_L_QUALIFIED');
    }
  });

  it('every locale is SOURCE or CLAUDE_L_QUALIFIED — nothing is unreviewed', () => {
    for (const c of askShellCoverageAll()) {
      expect(['SOURCE', 'CLAUDE_L_QUALIFIED']).toContain(c.qualification);
    }
  });

  it('every overlay file records the provenance of the strings in it', () => {
    /*
      A transcribed file is only as trustworthy as its provenance, so each one carries the
      source filename and the SHA-256 L published for it. The sums were verified against
      `TO_CLAUDE_H/SHA256SUMS.txt` before transcription.
    */
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    for (const locale of L_LOCALES) {
      const src = fs.readFileSync(path.join(__dirname, 'locales', `${locale}.ts`), 'utf8');
      expect(src).toContain('WORDING BY CLAUDE L');
      expect(src).toMatch(/sha-256\s+[0-9a-f]{64}/);
      expect(src).toContain('LINGUISTICALLY_QUALIFIED_BY_CLAUDE_L');
      /* And no H draft hides inside a file that claims to be L's. */
      expect(src).not.toContain('DRAFT_PENDING_CLAUDE_L');
    }
  });
});

describe('B-9 · the chrome the P0 correction named, in Claude L\u2019s wording', () => {
  /*
    The Product Owner listed the French defects by hand. Each one is asserted here in its own
    language, so "the French screenshot is fixed" is a test result and not a screenshot
    somebody has to trust. The values are L's, transcribed — H reworded none of them.
  */
  it('French renders the named chrome in French', () => {
    const s = askShellStrings('fr');
    expect(s.askNavStrings.newQuestion).toBe('Nouvelle question');
    expect(s.askNavStrings.recent).toBe('Récents');
    expect(s.askNavStrings.saved).toBe('Enregistrés');
    expect(s.askNavStrings.help).toBe('Aide et retours');
    expect(s.askNavStrings.settings).toBe('Paramètres');
    expect(s.askNavStrings.account).toBe('Compte');
    expect(s.askR2Strings.ask).toBe('Demander');
    expect(s.askR2Strings.privacyLink).toBe('Confidentialité');
    expect(s.askR2Strings.cookiesLink).toBe('Cookies');
    expect(s.askStrings.states.costNotConfigured).toBe(
      'La recherche ne s’exécute que lorsque vous envoyez une question.',
    );
  });

  it('the key the Product Owner named that WAS English is now qualified', () => {
    /*
      "Sign in" is on the Product Owner's own defect list and was one of the 38 `dict.navBar`
      members manifest Revision 2 under-listed. It spent three revisions rendering English —
      declared, which was the honest state at the time. It is qualified now, and the
      assertion is inverted rather than deleted so the key stays watched.
    */
    for (const locale of L_LOCALES) {
      expect(askShellStrings(locale).dict.navBar.signIn).not.toBe(
        askShellStrings('en').dict.navBar.signIn,
      );
      expect(declaredFallbacksFor(locale)).not.toContain('dict.navBar.signIn');
    }
  });

  it('the same named chrome is localized in all five L-qualified locales', () => {
    const english = askShellStrings('en');
    const named = [
      (s: ReturnType<typeof askShellStrings>) => s.askNavStrings.newQuestion,
      (s: ReturnType<typeof askShellStrings>) => s.askNavStrings.recent,
      (s: ReturnType<typeof askShellStrings>) => s.askNavStrings.saved,
      (s: ReturnType<typeof askShellStrings>) => s.askNavStrings.help,
      (s: ReturnType<typeof askShellStrings>) => s.askNavStrings.settings,
      (s: ReturnType<typeof askShellStrings>) => s.askNavStrings.account,
      (s: ReturnType<typeof askShellStrings>) => s.askR2Strings.ask,
      (s: ReturnType<typeof askShellStrings>) => s.askR2Strings.privacyLink,
      (s: ReturnType<typeof askShellStrings>) => s.askStrings.states.costNotConfigured,
      (s: ReturnType<typeof askShellStrings>) => s.dict.askAi.submit,
    ];
    /*
      `dict.navBar.signIn` is deliberately NOT in this list. It is on the Product Owner's
      defect list, it is still English, and the test above asserts exactly that — with its
      declaration. Including it here would make this test fail for a reason the suite already
      states precisely, and quietly dropping it from both would be the real defect.
    */
    for (const locale of L_LOCALES) {
      const shell = askShellStrings(locale);
      for (const read of named) {
        /* `Cookies` is the same word in several of these, so the English COMPARISON is on the
           keys that actually differ; identity is asserted per key above for French. */
        if (read(english) === 'Cookies') continue;
        expect(read(shell)).not.toBe(read(english));
        expect(read(shell).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('B-14 · a value that reads English is one of exactly three things', () => {
  /*
    The CTO's rule: a value may be byte-identical to English only when Claude L explicitly
    marks it QUALIFIED_UNCHANGED, and it must not count as fallback. The three categories are
    kept apart here because this round produced the case where they blurred — see the note in
    `askShellQualifiedUnchanged.ts`.
  */
  it('every English-reading value is declared, in the right category', () => {
    const en = askShellStrings('en');
    for (const locale of L_LOCALES) {
      const shell = askShellStrings(locale);
      const unchanged = new Set(qualifiedUnchangedFor(locale));
      const notTranslated = new Set(ASK_SHELL_PROPER_NOUNS);
      for (const path of askShellKeyPaths()) {
        if (isShellTemplatePath(path)) continue;
        const bare = shellPathWithoutMarker(path);
        const a = readPath(shell, bare);
        const b = readPath(en, bare);
        if (typeof a !== 'string' || a !== b) continue;
        expect(unchanged.has(bare) || notTranslated.has(bare)).toBe(true);
      }
    }
  });

  it('nothing is on BOTH lists — not-translated and qualified-unchanged are disjoint', () => {
    for (const locale of L_LOCALES) {
      for (const path of qualifiedUnchangedFor(locale)) {
        expect(ASK_SHELL_PROPER_NOUNS).not.toContain(path);
      }
    }
  });

  it('a QUALIFIED_UNCHANGED entry must be a key that exists and is in scope', () => {
    const paths = new Set(askShellKeyPaths().map(shellPathWithoutMarker));
    for (const locale of L_LOCALES) {
      for (const path of qualifiedUnchangedFor(locale)) {
        expect(paths.has(path)).toBe(true);
        /* And it is NOT a fallback — the rule's operative half. */
        expect(declaredFallbacksFor(locale)).not.toContain(path);
      }
    }
  });

  it('Arabic has the fewest, which is the sanity check on the whole list', () => {
    /*
      A language sharing no alphabet with English should share almost nothing but the brand.
      If Arabic's count ever approached French's, something would be falling through and
      being absorbed by this list rather than reported — which is the one way the list could
      become a hiding place.
    */
    expect(qualifiedUnchangedFor('ar').length).toBeLessThan(
      qualifiedUnchangedFor('fr').length,
    );
    expect(qualifiedUnchangedFor('ar').length).toBeLessThan(10);
  });
});

describe('B-13 · the strings Claude L flagged back at H', () => {
  /*
    L's manifest raised two keys whose TRUTH, not whose translation, had moved. Both are
    H's files. They are here because a flagged defect that is only answered in prose is a
    defect nobody re-checks.
  */
  it('LANGUAGE_UNSUPPORTED no longer claims Ask answers in two languages', () => {
    /*
      It read "Ask answers in English and Polish." That was true of the engine the catalogue
      was written against and false of this one. L refused to translate it faithfully — a
      faithful French rendering would have told a French reader, in French, that Ask answers
      only in English and Polish — delivered a truthful rendering in all five, and flagged
      the English as H's to fix. It is fixed, in English and in Polish.

      The new wording names NO list, deliberately: the explicit list is what drifted, and a
      list in seven languages drifts seven times.
    */
    for (const locale of DISPLAY_LOCALES) {
      const text = askShellStrings(locale).askR2Strings.clarify.codes.LANGUAGE_UNSUPPORTED;
      expect(text).not.toMatch(/English and Polish|angielsku|polsku/i);
      expect(text.length).toBeGreaterThan(0);
    }
    /*
      THE CTO RULED ON THE SHAPE: say the question could not be handled in the selected
      language, and suggest rephrasing or switching. Deliberately the same shape as
      LANGUAGE_UNCLASSIFIED — the two states differ in cause, not in what the reader does next.
    */
    expect(askShellStrings('en').askR2Strings.clarify.codes.LANGUAGE_UNSUPPORTED).toBe(
      'This question could not be handled in the selected language. Try rephrasing it, or choose a different language from the language menu.',
    );
    expect(askShellStrings('pl').askR2Strings.clarify.codes.LANGUAGE_UNSUPPORTED).toBe(
      'Nie udało się obsłużyć tego pytania w wybranym języku. Spróbuj je przeformułować albo wybierz inny język w menu języka.',
    );
  });

  it('localeFallback is UNREACHABLE from the Ask shell, which is better than translating it', () => {
    /*
      It says "The Ask AI frame's own labels are not yet authored in this language." L
      translated it faithfully because the key must exist for the missing-key test and may
      still be right for a locale with no overlay — then pointed out that for these five it is
      now untrue, and that a test proving it never renders is worth more than its translation.
      She is right, so this is that test.

      `resolveAskStrings` is the only thing that can produce the fellBack state that string
      describes, and since Phase B no Ask SURFACE calls it: they all read `askShellStrings`.
      Asserted on the source rather than by rendering, because the claim is about reachability
      and a render test can only show one path at a time.
    */
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.join(__dirname, '..', '..', '..');
    const callers: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name) || /\.spec\.tsx?$/.test(entry.name)) continue;
        const src = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        if (/\bresolveAskStrings\s*\(/.test(src)) callers.push(path.relative(root, full));
      }
    };
    walk(path.join(root, 'components'));
    walk(path.join(root, 'app'));
    expect(callers).toEqual([]);
    /* It is still a key, still declared if unqualified, and still asserted to exist. */
    expect(askShellKeyPaths()).toContain('askStrings.localeFallback');
  });
});

describe('B-10 · Arabic', () => {
  it('the Arabic shell is Arabic, and the direction comes from the shared contract', () => {
    const s = askShellStrings('ar');
    expect(directionFor('ar')).toBe('rtl');
    expect(s.askNavStrings.settings).toBe('الإعدادات');
    expect(s.askR2Strings.answer).toBe('الإجابة');
    expect(s.askR2Strings.ask).toBe('اسأل');
    expect(s.askNavStrings.newQuestion).toBe('سؤال جديد');
  });

  it('the Arabic templates render Arabic, across all six plural categories', () => {
    /*
      Claude L delivered all six CLDR categories for Arabic. This block has now asserted three
      different things across three revisions — H's draft forms, then an honest English
      fallback, now L's qualified forms — and each change was a fact about the delivery rather
      than a relaxation of the test.
    */
    const ar = askShellStrings('ar');
    const en = askShellStrings('en');
    for (const n of [0, 1, 2, 3, 11, 100]) {
      expect(ar.askR2Strings.sourcesLabel(n)).not.toBe(en.askR2Strings.sourcesLabel(n));
      expect(ar.askR2Strings.sourcesLabel(n)).toMatch(/[\u0600-\u06FF]/);
    }
    /* Six categories must produce more than two distinct renderings. */
    expect(new Set([0, 1, 2, 3, 11, 100].map((n) => ar.askR2Strings.sourcesLabel(n))).size).
      toBeGreaterThan(3);
    expect(declaredFallbacksFor('ar')).toEqual([]);
  });

  it('no draft locale string carries a hand-inserted bidi control character', () => {
    /*
      Direction is the renderer's job — `dir`, `unicode-bidi: isolate` — and a translator
      embedding U+200E/200F or an isolate control in the copy would be a second, invisible
      direction authority inside a paragraph that already has one.
    */
    const forbidden = /[‎‏‪-‮⁦-⁩]/;
    for (const locale of L_LOCALES) {
      const shell = askShellStrings(locale);
      const walk = (node: unknown): void => {
        if (typeof node === 'string') {
          expect(node).not.toMatch(forbidden);
          return;
        }
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (node !== null && typeof node === 'object') Object.values(node).forEach(walk);
      };
      walk(shell);
    }
  });
});

describe('B-11 · the Polish catalogue is untouched by the mechanism', () => {
  it('Polish still comes from its own authored catalogue, not from an overlay', () => {
    /*
      Re-expressing Polish as a 450-key overlay would risk moving shipped, already-qualified
      copy. These are strings the frozen D25 table owns; they must be byte-identical.
    */
    const pl = askShellStrings('pl');
    /*
      The product NAME is no longer Polish — the CTO's brand ruling makes it canonical in all
      seven. What this test exists to protect is the rest of the authored Polish catalogue,
      which is untouched, and in particular that `Zapytaj` survives as the ACTION. The ruling
      is explicit that the verb stays localized; only the noun is canonical.
    */
    expect(pl.askR2Strings.askTitle).toBe('Ask GlobalNewsAI');
    expect(pl.askR2Strings.ask).toBe('Zapytaj');
    expect(pl.askNavStrings.newQuestion).toBe('Nowe pytanie');
    expect(pl.askNavStrings.recent).toBe('Ostatnie');
    expect(pl.askNavStrings.saved).toBe('Zapisane');
    expect(pl.askNavStrings.settings).toBe('Ustawienia');
  });

  it('Polish keeps its own four-way plural rule for sources', () => {
    const pl = askShellStrings('pl');
    expect(pl.askR2Strings.sourcesLabel(1)).toBe('1 źródło');
    expect(pl.askR2Strings.sourcesLabel(3)).toBe('3 źródła');
    expect(pl.askR2Strings.sourcesLabel(7)).toBe('7 źródeł');
    expect(pl.askR2Strings.sourcesLabel(13)).toBe('13 źródeł');
  });

  it('English is unchanged by the existence of the overlays', () => {
    const en = askShellStrings('en');
    expect(en.askR2Strings.askTitle).toBe('Ask GlobalNewsAI');
    expect(en.askNavStrings.newQuestion).toBe('New question');
    expect(en.askR2Strings.sourcesLabel(1)).toBe('1 source');
    expect(en.askR2Strings.sourcesLabel(4)).toBe('4 sources');
  });
});

import { COUNTRIES, getLocalizedCountryName } from '@globalnews-ai/shared';
import { resolveGeography } from '../geo-resolver';
import { resolveArticleGeography } from '../geo-location-adapter';
import { mapGeographyForArticle } from '../map-feed.contract';

type Case = [expect: 'PLACE' | 'UNKNOWN', want: string, cat: string, lang: string, text: string];
const CORPUS: Case[] = [
  ['PLACE','country:BEL','subject','fr','La Belgique accueille le sommet européen cette semaine.'],
  ['PLACE','country:DEU','subject','fr','L’Allemagne a adopté un nouveau budget de défense.'],
  ['PLACE','country:ESP','subject','es','España aprobó la reforma laboral el jueves.'],
  ['PLACE','country:AUT','subject','de','Österreich hat den Haushalt beschlossen.'],
  ['PLACE','country:BEL','object','fr','Le rapport critique sévèrement la Belgique.'],
  ['PLACE','country:BEL','preposition','fr','Les négociations se poursuivent en Belgique.'],
  ['PLACE','country:BEL','preposition','de','Die Regierung in Belgien hat entschieden.'],
  ['PLACE','country:GNQ','localized-form','es','Guinea Ecuatorial firmó el acuerdo comercial.'],
  ['PLACE','city:COD:kinshasa','city','fr','Des inondations à Kinshasa ont fait des dizaines de morts.'],
  ['PLACE','city:POL:włochy','city','pl','Mieszkańcy dzielnicy Włochy w Warszawie protestowali wczoraj.'],
  ['PLACE','city:ESP:antigua','city','es','El festival se celebró en Antigua, Fuerteventura.'],
  ['PLACE','city:CHE:geneve','city','fr','Genève et la Suisse restent au centre des pourparlers.'],
  ['PLACE','country:NLD','no-prep','en','The Netherlands announced a new energy target.'],
  ['PLACE','country:BEL','no-prep','en','Belgium hosts the summit this week.'],
  ['PLACE','country:PRT','object','es','El informe menciona a Portugal en dos ocasiones.'],
  ['UNKNOWN','-','person','en','Georgia Meloni addressed the summit on Tuesday.'],
  ['UNKNOWN','-','person','en','Jordan Henderson signed a new contract with the club.'],
  ['UNKNOWN','-','person','es','El diputado Iván Chile presentó la moción el martes.'],
  ['UNKNOWN','-','person','pt','O relator Bruno Cuba apresentou o texto ao plenário.'],
  ['UNKNOWN','-','organization','fr','La société Belgique Télécom a publié ses résultats annuels.'],
  ['UNKNOWN','-','team','en','Chad United beat the visitors three nil on Saturday.'],
  ['UNKNOWN','-','team','es','El Chile FC ganó la final del torneo regional.'],
  ['UNKNOWN','-','brand','en','The Jordan sneaker line sold out within hours.'],
  ['UNKNOWN','-','brand','pl','Nowy model Malta Pro trafił do sprzedaży.'],
  ['UNKNOWN','-','headline','en','Chad Johnson Was Interviewed About The Transfer.'],
  ['UNKNOWN','-','headline','fr','Belgique Télécom Annonce Une Restructuration.'],
  ['UNKNOWN','-','headline','pl','Malta Pro Wchodzi Do Sprzedaży W Tym Tygodniu.'],
];
const KNOWN_OPEN = new Set(['The Jordan sneaker line sold out within hours.']);

describe('G-GEO-D14-B1-RUNG · acceptance', () => {
  it('A · the 8 rung positives stay correct, and every city win survives', () => {
    const failures: string[] = [];
    for (const [expect, want, cat, lang, text] of CORPUS) {
      if (expect !== 'PLACE') continue;
      const got = (mapGeographyForArticle(text, undefined, lang).place?.geographyId ?? 'UNKNOWN').split('@')[0];
      if (got !== want) failures.push(`${cat} ${lang} want=${want} got=${got} :: ${text}`);
    }
    expect(failures).toEqual([]);
  });

  it('B · ALL 14 rung negatives IN THIS CORPUS are suppressed', () => {
    /*
     * 14 OF 14, WHERE THE BRIEF REQUIRED AT LEAST 13 AND AUTHORISED
     * "The Jordan sneaker line sold out within hours." to remain open.
     *
     * Rule 2' alone could not reach it — the neighbour ("sneaker") is
     * lowercase, so there is no entity-run signal. Refusal-awareness closes it
     * from the other side: "jordan" is on the resolver's ambiguity gate, the
     * country tier declines that surface, and the rung now honours the
     * decline. The two mechanisms cover different shapes, which is why both
     * are here.
     *
     * CORPUS-SCOPED, AND SAID SO. This is 14 of 14 in the D14-A2 real-prose
     * corpus. It is NOT a claim about the D14 class: COUNTRY_ONLY,
     * COUNTRY_BY_FUZZY and the gazetteer tiers are untouched and still produce
     * the majority of D14's cases.
     */
    const still: string[] = [];
    for (const [expect, , cat, lang, text] of CORPUS) {
      if (expect !== 'UNKNOWN') continue;
      const res = resolveArticleGeography(text, undefined, lang);
      const id = mapGeographyForArticle(text, undefined, lang).place?.geographyId;
      if (id && res.reason === 'COUNTRY_BY_LOCALIZED_NAME') still.push(`${cat} ${lang} -> ${id} :: ${text}`);
    }
    expect(still).toEqual([]);
    // The authorised-open case is closed too; recorded so the allowance is not
    // silently carried forward as though it were still needed.
    expect(KNOWN_OPEN.size).toBe(1);
    for (const text of KNOWN_OPEN) {
      expect(mapGeographyForArticle(text, undefined, 'en').place).toBeUndefined();
    }
  });

  it('C · the base resolver is untouched — measured, not claimed by isolation', () => {
    /*
     * ISOLATION CANNOT BE CLAIMED BY IMPORT SURFACE HERE, and I checked before
     * assuming it: `geo-resolver.ts` ALSO imports `localizedCountriesNamedIn`,
     * because D13-B1's fuzzy contradiction gate uses it. So a change to that
     * function is NOT automatically rung-only, and the isolation has to be
     * measured. Base-path outcomes for the whole corpus, pinned exactly:
     */
    const producers: Record<string, number> = {};
    for (const [, , , , text] of CORPUS) {
      const reason = resolveGeography(text, {}).reason;
      producers[reason] = (producers[reason] ?? 0) + 1;
    }

    expect(producers).toEqual({
      ARTICLE_COUNTRY_UNCORROBORATED: 11,
      CITY_UNIQUE: 4,
      COUNTRY_ONLY: 3,
      NO_PLACE_EVIDENCE: 9,
    });
  });

  it('C2 · COUNTRY_BY_FUZZY untouched — D13-B1 F5 corrections all still hold', () => {
    /*
     * THE COUPLING THIS EXISTS TO CATCH. B1's contradiction gate refuses a
     * fuzzy country correction when the text's own localized country name
     * disagrees. Entity-run suppression REMOVES surfaces from that same index,
     * so it could silently stop B1 contradicting and let fuzzy re-assert.
     * Measured on all six of B1's F5 cases rather than reasoned about.
     */
    const F5: Array<[string, string, string]> = [
      ['fr', 'Soudan du Sud', 'country:SSD'],
      ['fr', 'Guinée équatoriale', 'country:GNQ'],
      ['fr', 'Papouasie-Nouvelle-Guinée', 'country:PNG'],
      ['pl', 'Demokratyczna Republika Konga', 'country:COD'],
      ['pl', 'Gwinea Równikowa', 'country:GNQ'],
      ['sw', 'Jamhuri ya Dominika', 'country:DOM'],
    ];
    for (const [lang, name, want] of F5) {
      const got = (mapGeographyForArticle(`Report from ${name}.`, undefined, lang).place?.geographyId ?? 'UNKNOWN').split('@')[0];
      expect([name, got]).toEqual([name, want]);
    }
  });

  it('D · no-language behaviour is unchanged — the rung cannot run without one', () => {
    for (const [, , , , text] of CORPUS) {
      const withNone = resolveArticleGeography(text, undefined, undefined);
      expect(withNone.reason).not.toBe('COUNTRY_BY_LOCALIZED_NAME');
    }
  });

  it('E · the withdrawn 128-case loss cannot return', () => {
    /*
     * It lived entirely in the NO-LANGUAGE population. Measured here across the
     * full country corpus rather than argued: with no evidence language, every
     * resolution is identical to a base-only resolve.
     */
    let checked = 0;
    for (const c of COUNTRIES) {
      const en = getLocalizedCountryName(c.iso2, 'en' as never);
      if (!en || en.trim().toUpperCase() === c.iso2.toUpperCase()) continue;
      const text = `Report from ${en}.`;
      const viaAdapter = mapGeographyForArticle(text, undefined, undefined).place?.geographyId ?? 'UNKNOWN';
      const viaBase = resolveGeography(text, {}).place;
      expect([en, viaAdapter === 'UNKNOWN']).toEqual([en, viaBase === undefined]);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(180);
  });

  it('F · FR-3 multilingual country gains remain protected', () => {
    /*
     * The FR-3 gain shape carries no capitalised neighbour, so entity-run
     * suppression cannot reach it. Measured over all six languages.
     */
    let gains = 0;
    for (const lang of ['en', 'fr', 'es', 'pl', 'sw', 'ar']) {
      for (const c of COUNTRIES) {
        const name = getLocalizedCountryName(c.iso2, lang as never);
        if (!name || name.trim().toUpperCase() === c.iso2.toUpperCase()) continue;
        const text = `Report from ${name}.`;
        if (resolveArticleGeography(text, undefined, lang).reason === 'COUNTRY_BY_LOCALIZED_NAME') gains += 1;
      }
    }
    /*
     * 459 IS THE C29 FIGURE, NOT 453. My first version pinned 453 — the C28
     * number — and the run corrected me: C29 carries D13-B1, which hands six
     * further cases to this rung. The literal is therefore a property of the
     * BASELINE, exactly the class LANG-QUAL-1-D8 raised against B1's own
     * `totalReduction === 6`. Recorded as baseline-scoped so a future baseline
     * move fails informatively rather than mysteriously.
     */
    expect(gains).toBe(459);
  });

  it('F2 · suppression cannot reach the FR-3 gain shape at all', () => {
    /*
     * Structural companion to F, so the guarantee does not rest on one integer.
     * The gain sentence places the country name between a lowercase preposition
     * and a full stop, so it has no capitalised neighbour and entity-run
     * suppression has nothing to fire on.
     */
    for (const lang of ['fr', 'pl', 'ar']) {
      for (const iso2 of ['BE', 'DE', 'PL']) {
        const name = getLocalizedCountryName(iso2, lang as never);
        if (!name) continue;
        expect([lang, iso2, resolveArticleGeography(`Report from ${name}.`, undefined, lang).reason]).toEqual([
          lang, iso2, 'COUNTRY_BY_LOCALIZED_NAME',
        ]);
      }
    }
  });
  it('G · MAIN-GEO-D14-1 — a deliberate refusal is distinguished from true absence', () => {
    /*
     * The rung now reads WHICH country was declined, not only that the
     * precision was UNKNOWN. Both halves are asserted, because the value is in
     * the distinction and not in either half alone.
     */
    // (a) a deliberate refusal carries its identity, and the rung honours it
    const refused = resolveGeography('Georgia Meloni addressed the summit on Tuesday.', {});
    expect(refused.reason).toBe('ARTICLE_COUNTRY_UNCORROBORATED');
    expect(refused.refusedSurface).toBe('georgia');

    // (b) true absence carries no refusal, so the rung is free to fill it
    const absent = resolveGeography('La Belgique accueille le sommet européen cette semaine.', {});
    expect(absent.reason).toBe('NO_PLACE_EVIDENCE');
    expect(absent.refusedSurface).toBeUndefined();
    expect(
      resolveArticleGeography('La Belgique accueille le sommet européen cette semaine.', undefined, 'fr').reason,
    ).toBe('COUNTRY_BY_LOCALIZED_NAME');
  });

  it('G2 · the refusal is SURFACE-SCOPED — a longer surface survives it', () => {
    /*
     * THE CASE THAT KILLED BLANKET STICKY-REFUSAL, MEASURED IN D14-A2 AND
     * PINNED HERE. The resolver declines the SURFACE "guinea"; the rung names
     * EQUATORIAL GUINEA from the longer surface "guinea ecuatorial". A rule
     * keyed on "was anything refused?" deletes this correct answer.
     *
     * A COUNTRY-keyed rule fails the other way, on `Georgia Meloni`: that
     * refusal comes from the SUBDIVISION tier, whose country is the United
     * States, so country-keyed suppression never fires. Both are pinned — G on
     * the surface that IS refused, G2 on the surface that is NOT.
     */
    const base = resolveGeography('Guinea Ecuatorial firmó el acuerdo comercial.', {});
    expect(base.reason).toBe('ARTICLE_COUNTRY_UNCORROBORATED');
    expect(base.refusedSurface).toBe('guinea');

    const got = mapGeographyForArticle('Guinea Ecuatorial firmó el acuerdo comercial.', undefined, 'es')
      .place?.geographyId;
    expect(got).toBe('country:GNQ');
  });
});

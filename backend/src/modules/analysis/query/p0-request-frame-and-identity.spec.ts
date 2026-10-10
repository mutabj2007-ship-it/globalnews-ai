import { withoutReaderRequestFrame } from './reader-request-frame.util';
import { isAttributableToControlledEntity, withCanonicalEntityNames } from './controlled-entity-identity';
import { congoReadingOf, detectAmbiguousCountryMention } from '../anchor/event-anchor.util';

describe('P1 — the reader request frame is not the subject', () => {
  it.each([
    ['Give any reports about Eric Prince please.', 'Eric Prince.'],
    ['Give any recent reports about Eric Prince in Congo.', 'Eric Prince in Congo.'],
    ['Report abt Eric Prince in congo.', 'Eric Prince in congo.'],
    ['Show me the latest news on Kenya please', 'Kenya'],
    ['Are there any reports about the Goma airport?', 'the Goma airport?'],
    ['Could you please find articles about cholera in Uvira', 'cholera in Uvira'],
    ['Podaj mi najnowsze doniesienia o Kongu, proszę.', 'Kongu.'],
  ])('%s → %s', (q, subject) => expect(withoutReaderRequestFrame(q)).toBe(subject));

  it.each([
    'UN report on Gaza aid deliveries',
    'News of the World phone hacking',
    'What did the report say about inflation?',
    'please',
    'Give any reports about',
    'Report',
  ])('left exactly as written: %s', (q) => expect(withoutReaderRequestFrame(q)).toBe(q.trim()));
});

describe('P3 — controlled entity identity (closed, reviewed; no fuzzy matching)', () => {
  it('rewrites the reviewed variant only, and reports it', () => {
    expect(withCanonicalEntityNames('Eric Prince in Congo')).toEqual({
      query: 'Erik Prince in Congo',
      spellings: [{ asked: 'Eric Prince', searched: 'Erik Prince', entityId: 'erik-prince' }],
    });
    expect(withCanonicalEntityNames('eric prince').query).toBe('Erik Prince');
  });

  it.each(['Erick Prince', 'Eric Princeton', 'Prince Eric', 'Erik Prince'])('no rewrite: %s', (q) =>
    expect(withCanonicalEntityNames(q).spellings).toEqual([]),
  );

  it('evidence: canonical, or the variant WITH a context term', () => {
    expect(isAttributableToControlledEntity({ title: "Erik Prince's forces suffer loss in Congo" }, 'erik-prince')).toBe(true);
    expect(isAttributableToControlledEntity({ title: 'Eric Prince wins local chess title' }, 'erik-prince')).toBe(false);
    expect(isAttributableToControlledEntity({ title: 'Eric Prince, Blackwater founder, in Kinshasa' }, 'erik-prince')).toBe(true);
    expect(isAttributableToControlledEntity({ title: 'Eric Prince' }, 'unknown-id')).toBe(false);
  });
});

describe('which Congo an article is about', () => {
  it.each([
    ['Fighting in eastern Democratic Republic of Congo', 'COD'],
    ['Erik Prince in DR Congo', 'COD'],
    ['Clashes near Uvira, Congo', 'COD'],
    ['Election in the Republic of the Congo', 'COG'],
    ['Brazzaville talks on Congo river', 'COG'],
    ["Erik Prince's forces suffer battlefield loss in Congo", 'AMBIGUOUS'],
    ['Nairobi markets rally', undefined],
  ])('%s → %s', (text, reading) => expect(congoReadingOf(text)).toBe(reading));

  it('"Democratic Republic of Congo" is never a Brazzaville qualifier (fixed)', () => {
    expect(detectAmbiguousCountryMention('Erik Prince in eastern Democratic Republic of Congo')).toBeUndefined();
  });
});

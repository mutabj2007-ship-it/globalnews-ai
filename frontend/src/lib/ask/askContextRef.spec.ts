import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { askContextKey, askContextRefOf } from './askContextRef';

/**
 * UNIFIED INTELLIGENCE BINDING R2C — the ONE context-reference builder. References only (a story
 * by persisted article id, a country by code); story first; never both; nothing else crosses.
 */

describe('askContextRefOf — references only, story first, never both', () => {
  it('a story with a persisted article id → STORY {articleId} (no title, no country)', () => {
    expect(
      askContextRefOf(
        {
          title: 'Polish budget',
          articleId: 'gnews-123',
          countryCode: 'PL',
          url: 'https://x.example/a',
          sourceName: 'Wire',
        },
        { countryCode: 'KEN' },
      ),
    ).toEqual({ kind: 'STORY', articleId: 'gnews-123' });
  });

  it('a story context with no article but a country → GEOGRAPHY (e.g. /search?countryCode=)', () => {
    expect(askContextRefOf({ title: 'Poland', countryCode: 'PL' }, undefined)).toEqual({
      kind: 'GEOGRAPHY',
      countryCode: 'PL',
    });
  });

  it('no story → the Map geography; nothing → undefined (a generic Ask)', () => {
    expect(askContextRefOf(undefined, { countryCode: 'POL' })).toEqual({
      kind: 'GEOGRAPHY',
      countryCode: 'POL',
    });
    expect(askContextRefOf(undefined, undefined)).toBeUndefined();
  });

  it('a malformed id / code is not sent at all (the server would refuse it anyway)', () => {
    expect(askContextRefOf({ title: 'x', articleId: 'bad id' }, undefined)).toBeUndefined();
    expect(askContextRefOf(undefined, { countryCode: 'Poland' })).toBeUndefined();
    /* a story with a bad id falls back to its own country, never to an invented reference */
    expect(
      askContextRefOf({ title: 'x', articleId: 'bad id', countryCode: 'KE' }, undefined),
    ).toEqual({
      kind: 'GEOGRAPHY',
      countryCode: 'KE',
    });
  });

  it('the builder copies nothing but kind + id / code', () => {
    const src = readFileSync(join(__dirname, 'askContextRef.ts'), 'utf8');
    const fn = src.slice(src.indexOf('export function askContextRefOf'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).not.toMatch(/\.title|\.url|\.sourceName|\.displayName/);
  });
});

describe('askContextKey — the change identity (no request)', () => {
  it('distinguishes stories, countries and none; normalises country case', () => {
    expect(askContextKey(undefined)).toBe('none');
    expect(askContextKey({ kind: 'STORY', articleId: 'a' })).not.toBe(
      askContextKey({ kind: 'STORY', articleId: 'b' }),
    );
    expect(askContextKey({ kind: 'GEOGRAPHY', countryCode: 'pol' })).toBe(
      askContextKey({ kind: 'GEOGRAPHY', countryCode: 'POL' }),
    );
    expect(askContextKey({ kind: 'GEOGRAPHY', countryCode: 'POL' })).not.toBe(
      askContextKey({ kind: 'GEOGRAPHY', countryCode: 'KEN' }),
    );
  });
});

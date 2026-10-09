import {
  addressableName,
  DISPLAY_NAME_MAX_CHARS,
  normalizeDisplayName,
} from './display-name';

describe('REASON TO RETURN R1 · G6 — display name rule', () => {
  it('accepts real names in several scripts and normalises whitespace', () => {
    expect(normalizeDisplayName('  Anna   Maria ')).toEqual({ ok: true, value: 'Anna Maria' });
    expect(normalizeDisplayName("Ngozi O'Neill-Mutesi")).toEqual({
      ok: true,
      value: "Ngozi O'Neill-Mutesi",
    });
    expect(normalizeDisplayName('Łukasz').ok).toBe(true);
    expect(normalizeDisplayName('محمد').ok).toBe(true);
    expect(normalizeDisplayName('Jean-Pierre Habimana').ok).toBe(true);
  });

  it('treats empty or absent input as "clear the name" (neutral fallback)', () => {
    expect(normalizeDisplayName('   ')).toEqual({ ok: true, value: null });
    expect(normalizeDisplayName(null)).toEqual({ ok: true, value: null });
    expect(normalizeDisplayName(undefined)).toEqual({ ok: true, value: null });
  });

  it('refuses an email address — a name is never an email', () => {
    expect(normalizeDisplayName('anna@example.com')).toEqual({
      ok: false,
      code: 'DISPLAY_NAME_INVALID',
    });
  });

  it('refuses markup, URLs, control and bidi-override characters instead of stripping them', () => {
    for (const bad of ['<b>Anna</b>', 'https://x.test', 'Anna\u0000', 'Anna‮evil', 'a/b']) {
      expect(normalizeDisplayName(bad)).toEqual({ ok: false, code: 'DISPLAY_NAME_INVALID' });
    }
  });

  it('needs at least one letter', () => {
    expect(normalizeDisplayName('123').ok).toBe(false);
    expect(normalizeDisplayName('...').ok).toBe(false);
  });

  it('counts code points, so the bound is what a reader sees', () => {
    expect(normalizeDisplayName('a'.repeat(DISPLAY_NAME_MAX_CHARS)).ok).toBe(true);
    expect(normalizeDisplayName('a'.repeat(DISPLAY_NAME_MAX_CHARS + 1))).toEqual({
      ok: false,
      code: 'DISPLAY_NAME_TOO_LONG',
    });
  });

  it('never addresses a reader by a stored value that fails the rule', () => {
    expect(addressableName('anna@example.com')).toBeNull();
    expect(addressableName(null)).toBeNull();
    expect(addressableName(' Anna ')).toBe('Anna');
  });
});

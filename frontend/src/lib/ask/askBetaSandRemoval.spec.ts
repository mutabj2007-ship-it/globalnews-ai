import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AskDeepConfirm } from '@/components/ask-frame/AskDeepConfirm';
import { askR2Strings } from './askR2Strings';

/**
 * CTO PUBLIC BETA RULING B1 — the reader-visible Sand fixture is gone (EN + PL); the explicit
 * confirmation step for deeper analysis stays. No replacement price, estimate or billing promise.
 */
const visibleText = (r: ReactTestRenderer): string => {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === 'object')
      walk((node as { children?: unknown }).children);
  };
  walk(r.toJSON());
  return out.join(' ');
};
const FORBIDDEN =
  /\bSand\b|\d+\s*Sand|Estimate|Szacunek|szac\.|in Alpha|w wersji Alpha|Design fixture|Wartość projektowa|token|price|cena|koszt/i;

describe('B1 — strings (EN / PL)', () => {
  it('EN: the neutral copy the CTO specified, with no Sand, number or Alpha wording', () => {
    const s = askR2Strings('en');
    expect(s.runDeep).toBe('Run deeper analysis');
    expect(s.runDeepMeta).toBe('Asks before running');
    expect(s.deepBody).toBe(
      'Deeper analysis reads more sources across a wider window and prepares a structured report. It runs only after you confirm.',
    );
    expect(s.runConfirm).toBe('Run deeper analysis');
    for (const v of [s.runDeep, s.runDeepMeta, s.deepTitle, s.deepBody, s.runConfirm, s.notNow]) {
      expect(v).not.toMatch(FORBIDDEN);
    }
    expect(Object.keys(s)).not.toEqual(expect.arrayContaining(['estimate']));
    expect(Object.keys(s)).not.toEqual(expect.arrayContaining(['deepNote']));
  });

  it('PL: the same, in Polish', () => {
    const s = askR2Strings('pl');
    expect(s.runDeepMeta).toBe('Pyta przed uruchomieniem');
    expect(s.runConfirm).toBe('Uruchom pogłębioną analizę');
    expect(s.deepBody).toMatch(/Uruchamia się dopiero po Twoim potwierdzeniu\.$/);
    for (const v of [s.runDeep, s.runDeepMeta, s.deepTitle, s.deepBody, s.runConfirm, s.notNow]) {
      expect(v).not.toMatch(FORBIDDEN);
    }
  });

  it('no Ask surface source carries a Sand number or the Alpha fixture note', () => {
    const root = join(__dirname, '..', '..');
    for (const file of [
      'lib/ask/askR2Strings.ts',
      'components/ask-frame/AskDeepConfirm.tsx',
      'components/ask-frame/AskR2TurnView.tsx',
    ]) {
      const src = readFileSync(join(root, file), 'utf8');
      expect({
        file,
        hit: /\d+\s*Sand|Sand estimate|not enabled in Alpha|w wersji Alpha/.test(src),
      }).toEqual({
        file,
        hit: false,
      });
    }
  });
});

describe('B1 — the confirmation step is preserved', () => {
  /* The dialog only registers an Escape listener on window; node has no window. */
  beforeAll(() => {
    (globalThis as { window?: unknown }).window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  });
  afterAll(() => {
    delete (globalThis as { window?: unknown }).window;
  });
  function render(locale: 'en' | 'pl', onConfirm = jest.fn(), onCancel = jest.fn()) {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AskDeepConfirm, { locale, onConfirm, onCancel }));
    });
    return { r, onConfirm, onCancel };
  }
  const byData = (r: ReactTestRenderer, name: string) =>
    r.root.find((n) => typeof n.type === 'string' && n.props['data-ask'] === name);

  it.each(['en', 'pl'] as const)(
    '%s: a modal dialog that runs ONLY on the explicit confirm, with no price shown',
    (locale) => {
      const { r, onConfirm, onCancel } = render(locale);
      const dialog = byData(r, 'deep-confirm');
      expect(dialog.props.role).toBe('dialog');
      expect(dialog.props['aria-modal']).toBe('true');
      expect(visibleText(r)).not.toMatch(FORBIDDEN);
      expect(onConfirm).not.toHaveBeenCalled();
      act(() => byData(r, 'deep-cancel').props.onClick());
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
      act(() => byData(r, 'deep-run').props.onClick());
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(byData(r, 'deep-run').props.children).toBe(askR2Strings(locale).runConfirm);
    },
  );

  it('dialog geometry is unchanged: same backdrop, sheet and button classes as before B1', () => {
    const { r } = render('en');
    expect(byData(r, 'deep-confirm-backdrop').props.className).toBe(
      'fixed inset-0 z-[80] flex items-end justify-center bg-black/60 lg:items-center',
    );
    expect(byData(r, 'deep-confirm').props.className).toBe(
      'w-full max-w-[520px] rounded-t-2xl border border-[#6a5634] bg-[#0f1823] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#e8eef8] lg:rounded-2xl',
    );
    expect(byData(r, 'deep-run').props.className).toMatch(/min-h-\[44px\]/);
    expect(byData(r, 'deep-cancel').props.className).toMatch(/min-h-\[44px\]/);
  });
});

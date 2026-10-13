import { readFileSync } from 'fs';
import { join } from 'path';
import { askR38Strings } from '@/lib/ask/askR38Strings';
import { PICKER_PUBLISHER_CONTENT } from '@/lib/rights/pickerPublisherContent';

/*
  MASTER CTO R38 — the Product Owner's red-marked Alpha screens (U-1 typing void, U-2 oversized story
  dialog, U-3 pretend job search, U-4 place CTA beside an on-hold notice, U-5 monitoring-like
  "Check for changes", U-6 "COMPLETED" read as an available answer). Behaviour is pinned by the
  component specs (r23.pickerContinue, d01.hold, askR3FullDesign J01); this file pins the seams.
*/
const SRC = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('R38 · U-1 typing keeps one coherent composition', () => {
  const frame = read('components', 'ask-frame', 'AskFrameScreen.tsx');
  it('the welcome group collapses only on a compact viewport (phone keyboard / small phone), never on a tall one', () => {
    expect(frame).toMatch(/const typing = entryState && frameSize\.compact && \(composerFocused \|\| question\.trim\(\) !== ''\);/);
    /* compact is the existing width < 360 or height < 640 query */
    expect(frame).toContain("window.matchMedia('(max-width: 359px), (max-height: 639px)')");
  });
  it('the emblem keeps its ready pose unless the welcome group actually collapsed', () => {
    expect(frame).toMatch(/const emblemState = isPending \? 'leaving' : typing \? 'typing' : 'ready';/);
  });
  it('still one composer and one Send', () => {
    expect(code(frame).match(/<Composer\b/g)).toHaveLength(1);
  });
});

describe('R38 · U-2 Explain a story is a content-sized, honest dialog while stories are held', () => {
  it('the gate is the real one (HOLD) and the held dialog is content-sized, not the 760 px sheet', () => {
    expect(PICKER_PUBLISHER_CONTENT).toBe('HOLD');
    const picker = read('components', 'ask', 'StoryPicker.tsx');
    expect(picker).toMatch(/className=\{held \? `\$\{styles\.sheet\} \$\{styles\.sheetContent\}` : styles\.sheet\}/);
    const css = read('components', 'ask', 'd01.module.css');
    expect(css).toMatch(/\.sheet\.sheetContent \{\s*height: auto;\s*max-height: calc\(100% - 56px\);/);
    expect(css).toMatch(/@media \(min-width: 700px\) \{\s*\.sheet\.sheetContent \{\s*height: auto;\s*max-height: min\(86%, 760px\);/);
  });
  it('held, the dialog never requests stories or briefs', () => {
    const picker = code(read('components', 'ask', 'StoryPicker.tsx'));
    const describe = picker.slice(picker.indexOf('function PickerDescribe('), picker.indexOf('function PickerResults('));
    expect(describe).not.toMatch(/searchPickerStories|readStoryBrief|accountFetch|fetch\(/);
  });
});

describe('R38 · U-3 jobs say "not connected" first and never search', () => {
  const sheet = code(read('components', 'ask-frame', 'AskJobSetupSheet.tsx'));
  it('no search state, filters or outcome step remain', () => {
    expect(sheet).not.toMatch(/setOutcomeFor|jobSearch\b|jobMoreFilters|jobWorkType|data-ask="job-outcome"/);
  });
  it('the welcome cue and the job-context entry read as a career question', () => {
    expect(read('components', 'ask-frame', 'AskWelcomeEntries.tsx')).toContain("{ id: 'g3', label: askR38Strings(locale).jobsCue, run: onOpenJobs }");
    expect(read('components', 'ask-frame', 'AskR2TurnView.tsx')).toContain('{askR38Strings(locale).jobsCue}');
  });
});

describe('R38 · U-4 / U-5 / U-6 honest labels', () => {
  it('U-4 while reports are held, the place action is "Ask about <place>" with an honest note; Follow stays separate', () => {
    const place = read('components', 'ask', 'ChoosePlace.tsx');
    expect(place).toContain('{held ? askR38Strings(locale).placeAskAbout(name) : s.research}');
    expect(place).toContain('{held ? askR38Strings(locale).placeAskNote : s.researchNote}');
    expect(place).toContain('data-ask="place-follow"');
    expect(place).toContain("const PLACE_RESEARCH_HELD_ISO3: ReadonlySet<string> = new Set(['COD', 'COG']);");
  });
  it('U-5 My updates says nothing is checked automatically and names the action "Ask again"', () => {
    const updates = read('components', 'ask', 'MyUpdatesClient.tsx');
    expect(updates).toContain('{askR38Strings(locale).updatesManualNote}');
    expect(updates).toContain('{askR38Strings(locale).updatesAskAgain}');
    expect(askR38Strings('en').updatesManualNote).toMatch(/^Nothing is checked automatically\./);
  });
  it('U-6 Saved calls a completed operation a completed REQUEST, never an available answer', () => {
    const saved = read('components', 'ask', 'SavedClient.tsx');
    expect(saved).toMatch(/row\.state === 'COMPLETED'\s*\?\s*askR38Strings\(locale\)\.savedRequestCompleted/);
    expect(askR38Strings('en').savedRequestCompleted).toBe('Request completed');
  });
});

describe('R38 · every locale carries every string', () => {
  it.each(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'])('%s', (locale) => {
    for (const value of Object.values(askR38Strings(locale))) {
      const text = typeof value === 'function' ? (value as (...a: string[]) => string)('X') : value;
      expect(String(text).length).toBeGreaterThan(3);
    }
  });
});

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(__dirname, '../../../..');
const base = 'e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a';
const original = (file: string) => execFileSync('git', ['show', base + ':' + file], { cwd: root });
const frozen = [
 'frontend/src/components/energy/EnergySpatialSubstrate.tsx',
 'frontend/src/components/energy/EnergyChangeGrid.tsx',
 'frontend/src/components/energy/EnergyFlowSankey.tsx',
 'frontend/src/components/energy/EnergyAskOverlay.tsx',
 'frontend/src/lib/energy/energyTokens.ts',
 'frontend/src/lib/energy/energyFrame.ts',
 'frontend/src/lib/energy/energyUrl.ts',
 'frontend/src/components/market/MarketScreen.tsx',
 'frontend/src/components/market/MarketCompactScreen.tsx',
 'frontend/src/components/market/MktParts.tsx',
 'frontend/src/lib/market/mktTokens.ts',
 'frontend/src/lib/market/mktContract.spec.ts',
];
it.each(frozen)('preserves accepted bytes: %s', file => {
 expect(readFileSync(resolve(root, file)).equals(original(file))).toBe(true);
});
it('changes only the data expression in the existing Market context note', () => {
 const file = 'frontend/src/components/market/MktReader.tsx';
 const restored = readFileSync(resolve(root, file), 'utf8')
  .replace('  retainedObservationContext,\n', '')
  .replace('{retainedObservationContext(o) ?? t.reader.seriesNameNotCarried}', '{t.reader.seriesNameNotCarried}');
 expect(restored).toBe(original(file).toString('utf8'));
});
it('removes the substitute Energy architecture', () => {
 expect(existsSync(resolve(root, 'frontend/src/components/energy/EnergyRetainedSurface.tsx'))).toBe(false);
});

// Plan B explicitly authorizes binding and null handling, not geometry edits.
const planBEdits: Record<string, [string, string][]> = {
 'frontend/src/components/energy/EnergyShell.tsx': [
  ["{subject === null ? (urlState.substrate === 'spatial' && data.subjects.length > 0 && data.feed.length === 0 ? strings.hudEvidence : strings.substrateHeadline.change) : strings.lensTitle}","{subject === null ? strings.substrateHeadline.change : strings.lensTitle}"],
  ["<CompactFeed data={data} showSubjects={urlState.substrate === 'spatial'} strings={strings}","<CompactFeed data={data} strings={strings}"],
  ["function CompactFeed({ data, strings, onSelect, showSubjects }: { data: EnergyFrameData; strings: EnergyStrings; onSelect: (id: string | null) => void; showSubjects: boolean }): JSX.Element {\n  // Reuse the compact list for unranked identities; never put these into the change feed.\n  const items = data.feed.length > 0 ? data.feed : showSubjects ? data.subjects.map(subject => ({\n    subjectId: subject.id, readerState: subject.readerState, canonicalAbsence: subject.canonicalAbsence,\n    changeState: subject.changeState, tone: subject.tone, ago: '', title: subject.name, scopeLabel: subject.scopeLabel,\n  })) : [];\n  if (items.length === 0) {","function CompactFeed({ data, strings, onSelect }: { data: EnergyFrameData; strings: EnergyStrings; onSelect: (id: string | null) => void }): JSX.Element {\n  if (data.feed.length === 0) {"],
  ["{items.map((item, index) => (","{data.feed.map((item, index) => ("],
  ['(id: string, fallback: boolean | null): boolean | null => fallback === null ? null : watchOverrides[id] ?? fallback', '(id: string, fallback: boolean): boolean => watchOverrides[id] ?? fallback'],
  ['(id: string, current: boolean | null): void => {\n    if (current === null) return;', '(id: string, current: boolean): void => {'],
  ['watched: boolean | null;', 'watched: boolean;'],
  ['{ count: data.watchCount ?? ENERGY_ABSENT }', '{ count: data.watchCount }'],
  ["{subject.assessment ?? [strings.stateWhy[subject.readerState ?? 'NO_DATA'], ...subject.evidence.map(artifact => artifact.title)].join(' · ')}", "{subject.assessment ?? strings.stateWhy[subject.readerState ?? 'NO_DATA']}"],
 ],
 'frontend/src/components/energy/EnergyParts.tsx': [
  ['import { ENERGY_ABSENT, formatEnergyString, type EnergyStrings }', 'import { formatEnergyString, type EnergyStrings }'],
  ['watched: boolean | null;', 'watched: boolean;'],
  ["data-energy-watch={watched === null ? 'absent' : watched ? 'active' : 'inactive'}\n      disabled={watched === null}", "data-energy-watch={watched ? 'active' : 'inactive'}"],
  ['aria-pressed={watched ?? undefined}', 'aria-pressed={watched}'],
  ['{watched === null ? ENERGY_ABSENT : watched ? strings.watchWatching : strings.watchNotWatching}', '{watched ? strings.watchWatching : strings.watchNotWatching}'],
 ],
 'frontend/src/components/energy/EnergySubjectSurfaces.tsx': [
  ['key={field.id ?? field.key}', 'key={field.key}'],
  ['{artifact.sourceClass === null ? ENERGY_ABSENT : strings.sourceClass[artifact.sourceClass]}', '{strings.sourceClass[artifact.sourceClass]}'],
 ],
 'frontend/src/lib/energy/energyModel.ts': [
  ['readonly fields: readonly { readonly id?: string; readonly key: string; readonly value: string }[];', 'readonly fields: readonly { readonly key: string; readonly value: string }[];'],
  ['readonly sourceClass: EnergySourceClass | null;', 'readonly sourceClass: EnergySourceClass;'],
  ['readonly watched: boolean | null;', 'readonly watched: boolean;'],
  ['readonly watchCount: number | null;', 'readonly watchCount: number;'],
 ],
};
it.each(Object.entries(planBEdits))('Plan B changes only authorized data expressions: %s', (file, edits) => {
 let restored = readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n');
 for (const [current, prior] of edits) {
  expect(restored).toContain(current);
  restored = restored.replace(current, prior);
 }
 expect(restored).toBe(original(file).toString('utf8').replace(/\r\n/g, '\n'));
});
it('Plan B route preserves the exact accepted rendered hierarchy', () => {
 const file = 'frontend/src/app/energy/page.tsx';
 const render = (s: string) => s.slice(s.lastIndexOf('  return (')).replace('strings={energyRetainedStrings(retained, locale)}', 'strings={energyStrings(locale)}').replace(/\r\n/g, '\n');
 expect(render(readFileSync(resolve(root, file), 'utf8'))).toBe(render(original(file).toString('utf8')));
});

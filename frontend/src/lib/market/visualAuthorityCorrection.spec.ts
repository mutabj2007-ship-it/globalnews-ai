import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(__dirname, '../../../..');
const base = 'e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a';
const original = (file: string) => execFileSync('git', ['show', base + ':' + file], { cwd: root });
const frozen = [
 'frontend/src/components/energy/EnergyShell.tsx',
 'frontend/src/components/energy/EnergySpatialSubstrate.tsx',
 'frontend/src/components/energy/EnergyChangeGrid.tsx',
 'frontend/src/components/energy/EnergyFlowSankey.tsx',
 'frontend/src/components/energy/EnergySubjectSurfaces.tsx',
 'frontend/src/components/energy/EnergyAskOverlay.tsx',
 'frontend/src/components/energy/EnergyParts.tsx',
 'frontend/src/app/energy/page.tsx',
 'frontend/src/lib/energy/energyModel.ts',
 'frontend/src/lib/energy/energyTokens.ts',
 'frontend/src/lib/energy/energyFrame.ts',
 'frontend/src/lib/energy/energyUrl.ts',
 'frontend/src/lib/energy/energyVisualFrame.spec.ts',
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

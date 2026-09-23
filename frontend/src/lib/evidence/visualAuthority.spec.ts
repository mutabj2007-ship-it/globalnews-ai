import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Frozen authority: base e4e010a. Normalize checkout line endings only.
const authority = {
  "frontend/src/components/politics/PoliticsScreen.tsx": "34da5e4e962e447304a5c6e8c634f7d092fbdfcc1fbd8777402193af4c888f5f",
  "frontend/src/components/politics/PoliticsCompactScreen.tsx": "c060548af1b27e55747ee7efc4ed3af352f667d09f8c03952f231ad43800701f",
  "frontend/src/components/politics/PolParts.tsx": "d590d61a81d621d1c050a9991ad50c4bcd6a51207b571900af44ae5bd4696b64",
  "frontend/src/lib/politics/politicsSubject.ts": "5045f7cadd8df3ee85145322e00bad6faf3b1251f488257bda89ca38825f606b",
  "frontend/src/lib/election/electionReporting.ts": "3b2ac7174303a0af9eaed52d74540207e1c40496802195f852a512c518fbe114",
  "frontend/src/lib/election/electionStrings.ts": "f82290bed01a13e02eb61a06e4c77c0801f78594f460906dde8f048a96fda525",
  "frontend/src/app/politics-visual-preview/page.tsx": "ff2cdb49d9820dbf78211820841b1bf89da80adadcf6eb11782ac5ac2e8f4e14",
  "frontend/src/app/politics-visual-preview/compact/page.tsx": "d5ea0f6a28eb2878cf840fcae0b4fb34c4fd4e955c2e43684f5391883c65df2c"
};
const root = resolve(__dirname, '../../../..');
describe('visual correction preserves accepted authority', () => {
  it.each(Object.entries(authority))('%s is identical to the accepted base', (path, digest) => {
    let source = readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');
    // Plan B permits copy changes in existing slots, not frame changes.
    source = source.replace('Election Intelligence — retained evidence', 'Election Intelligence — provider-free preview').replace('Analiza wyborcza — zachowane dowody', 'Analiza wyborcza — podgląd bez dostawców').replace('No governed evidence is retained in this preview. This does not mean nothing happened. Jurisdiction, subject and source classes remain unassessed.', 'Nothing currently meets the attention threshold. This is a result, not an error.');
    expect(createHash('sha256').update(source).digest('hex')).toBe(digest);
  });
  it('removes both replacement dashboard families', () => {
    for (const path of ['frontend/src/components/election/ElectionEvidenceScreen.tsx', 'frontend/src/components/politics/PoliticsEvidenceScreen.tsx']) expect(existsSync(resolve(root, path))).toBe(false);
  });
});

const acceptedClasses: Record<string, string[]> = {
  "frontend/src/components/election/ElectionPreviewScreen.tsx": [
    "className=\"flex min-h-screen flex-col gap-[18px] bg-sp-bg px-[16px] py-[18px] text-sp-ink-2 md:px-[28px]\"",
    "className=\"flex flex-col gap-[8px]\"",
    "className=\"text-[17px] font-medium leading-[1.3] text-sp-ink\"",
    "className={ELN_MICRO}",
    "className=\"max-w-[72ch] text-[12px] leading-[1.55] text-sp-ink-3\"",
    "className=\"px-[10px]\"",
    "className=\"flex items-center\"",
    "className=\"text-[12px] leading-[1.5] text-sp-ink-3\"",
    "className=\"p-[12px]\"",
    "className=\"flex flex-col\"",
    "className=\"flex flex-wrap items-center gap-[10px]\"",
    "className=\"flex flex-wrap items-center gap-[8px]\"",
    "className={`${ELN_MICRO} mt-[8px]`}"
  ],
  "frontend/src/components/election/ElnParts.tsx": [
    "className=\"flex min-w-0 flex-col gap-[10px]\"",
    "className=\"flex flex-wrap items-baseline gap-[10px]\"",
    "className=\"h-[5px] w-[5px] shrink-0 self-center rounded-full bg-sp-cyan/70\"",
    "className={`${ELN_MICRO} font-medium text-sp-ink-2`}",
    "className={ELN_MICRO}",
    "className={`border border-sp-line bg-sp-panel ${className}`}",
    "className={`${ELN_MICRO} border px-[7px] py-[3px] ${\n        amber ? 'border-sp-amber/60 text-sp-amber' : 'border-sp-line text-sp-ink-2'\n      }`}",
    "className={`inline-flex items-baseline gap-[6px] px-[7px] py-[3px] text-[13px] ${treatment.inkClass} ${border}`}",
    "className=\"flex min-w-0 items-baseline justify-between gap-[12px] px-[12px] py-[10px]\"",
    "className=\"min-w-0 break-words text-[13px] leading-[1.45] text-sp-ink-2\"",
    "className={`${ELN_MICRO} shrink-0`}",
    "className=\"flex flex-1 items-center justify-center\"",
    "className=\"font-gn-mono text-[18px] text-sp-ink-3\""
  ]
};

describe('Plan B preserves accepted Election geometry', () => {
  it.each(Object.entries(acceptedClasses))('%s uses only accepted classes', (path, allowed) => {
    const source = readFileSync(resolve(root, path), 'utf8');
    const classes = [...source.matchAll(/className=(?:"[^"]*"|\{\x60[^\x60]*\x60\}|\{ELN_MICRO\})/g)].map(m => m[0]);
    const disclosure = ['className="mt-[8px]"', 'className="cursor-pointer"'];
    expect(classes.filter(c => !allowed.includes(c) && !disclosure.includes(c))).toEqual([]);
    for (const required of allowed.filter(c => !c.includes('shrink-0') && !c.includes('mt-[8px]'))) expect(classes).toContain(required);
  });
  it('keeps the four region sequence without new chrome', () => {
    const source = readFileSync(resolve(root, 'frontend/src/components/election/ElectionPreviewScreen.tsx'), 'utf8');
    expect([...source.matchAll(/<Region title=\{t\.(\w+)\}/g)].map(m => m[1]))
      .toEqual(['hudRegion', 'indicatorRegion', 'contestantRegion', 'readingsRegion']);
    expect(source).toContain('HUD_LINE_PX');
    expect(source).not.toMatch(/className="[^"]*(?:fixed|sticky)/);
  });
});

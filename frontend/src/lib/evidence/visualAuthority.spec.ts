import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Frozen authority: base e4e010a. Normalize checkout line endings only.
const authority = {
  "frontend/src/components/politics/PoliticsScreen.tsx": "34da5e4e962e447304a5c6e8c634f7d092fbdfcc1fbd8777402193af4c888f5f",
  "frontend/src/components/politics/PoliticsCompactScreen.tsx": "c060548af1b27e55747ee7efc4ed3af352f667d09f8c03952f231ad43800701f",
  "frontend/src/components/politics/PolParts.tsx": "d590d61a81d621d1c050a9991ad50c4bcd6a51207b571900af44ae5bd4696b64",
  "frontend/src/components/election/ElectionPreviewScreen.tsx": "5cc0f533ef60d9dfa8050ba51468dbb654b8e66a4a1f186c0e719f69b6fcf6e2",
  "frontend/src/components/election/ElnParts.tsx": "39e980918275e394e9c9dd4d3b9fd4731d8af38950f9714fb5310fada1114ffd",
  "frontend/src/lib/politics/politicsVisualFrame.spec.ts": "21aa6129fcb58d8b5b36224b12daf5e4ba491fc9823645adade9f794ba898854",
  "frontend/src/lib/politics/politicsStrings.ts": "0346c625c7540f09bb5e0e2b72adb271b798f38f4863800e3283a6f66cd77174",
  "frontend/src/lib/politics/politicsSubject.ts": "5045f7cadd8df3ee85145322e00bad6faf3b1251f488257bda89ca38825f606b",
  "frontend/src/lib/election/electionContract.spec.ts": "fa2db27e06fb586f87f3a4594a4e4755e6d47f564ab1d7a1fcfb217eac7ca5e5",
  "frontend/src/lib/election/electionPreview.ts": "cbff7209c61ce8e2f3e13fd35ddf9648147e66754f80da0b278de62b863153d4",
  "frontend/src/lib/election/electionReporting.ts": "3b2ac7174303a0af9eaed52d74540207e1c40496802195f852a512c518fbe114",
  "frontend/src/lib/election/electionStrings.ts": "f82290bed01a13e02eb61a06e4c77c0801f78594f460906dde8f048a96fda525",
  "frontend/src/app/election-visual-preview/page.tsx": "432803679983a48850e23c1234e3a62f3c0d69d03c3ad8511af544a50cf6b3b3",
  "frontend/src/app/election-visual-preview/compact/page.tsx": "7ec1bfede05bb067fed5e20e74b20b80d24bc79e9a0ffdbaabcc44791b7e3bee",
  "frontend/src/app/politics-visual-preview/page.tsx": "ff2cdb49d9820dbf78211820841b1bf89da80adadcf6eb11782ac5ac2e8f4e14",
  "frontend/src/app/politics-visual-preview/compact/page.tsx": "d5ea0f6a28eb2878cf840fcae0b4fb34c4fd4e955c2e43684f5391883c65df2c"
};
const root = resolve(__dirname, '../../../..');
describe('visual correction preserves accepted authority', () => {
  it.each(Object.entries(authority))('%s is identical to the accepted base', (path, digest) => {
    const source = readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(source).digest('hex')).toBe(digest);
  });
  it('removes both replacement dashboard families', () => {
    for (const path of ['frontend/src/components/election/ElectionEvidenceScreen.tsx', 'frontend/src/components/politics/PoliticsEvidenceScreen.tsx']) expect(existsSync(resolve(root, path))).toBe(false);
  });
});

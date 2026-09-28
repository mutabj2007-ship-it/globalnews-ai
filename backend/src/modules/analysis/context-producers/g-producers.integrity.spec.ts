import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — G's ACCEPTED PRODUCERS, IN-TREE.
 *
 * Contract §2: "Integrate G's accepted producer set." The twelve source/spec files are
 * vendored BYTE-IDENTICAL from G-ASK-R2-CONTEXT-PRODUCER-CLOSURE-R1 (the six accepted R1
 * files + their specs) and -FINAL-ADDENDUM (the v2 eligibility rule, its contract, corpus
 * and spec), at G's declared target path. Every byte is re-verified here against each
 * package's own MANIFEST.sha256; the manifests themselves are pinned by literal digest.
 * G's own 193-test suite runs unchanged beside this spec.
 */

const DIR = __dirname;
const sha = (file: string): string =>
  createHash('sha256')
    .update(readFileSync(join(DIR, file)))
    .digest('hex');

const MANIFESTS = {
  'G-R1-MANIFEST.sha256': '2f43386cc2ea01fad4e53d20849db7cd7f98d58d35bf23d9f74973956dcc1e55',
  'G-FINAL-ADDENDUM-MANIFEST.sha256':
    'e7b3d29bcd61c853a7d86cf92ad779e38f7742f6c08e7ed50b7028baf266ff82',
} as const;

const PACKAGE_DIGESTS = {
  /* archive digests, verified against their .sha256 sidecars in _authority/INPUT-AUTHORITY-REGISTER-R1.md */
  'G-ASK-R2-CONTEXT-PRODUCER-CLOSURE-R1.zip':
    '2a1078db4040e33db13d5c8e443da0cf3d7ced860ce153d3c86419518cdbacc5',
  'G-ASK-R2-CONTEXT-PRODUCER-CLOSURE-R1-FINAL-ADDENDUM.zip':
    '61c97318481ce16d11c9903566dfbce778ba2609785e02a0e8c7c98ca163e3c7',
};

function srcEntries(manifest: string): Array<[string, string]> {
  return readFileSync(join(DIR, manifest), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => / \.\/src\//.test(l))
    .map((l) => {
      const [hash, path] = l.split(/\s+/);
      return [path!.replace('./src/', ''), hash!];
    });
}

describe('G producers — byte identity against their packages’ manifests', () => {
  it('the two manifest copies are the packages’ own (pinned)', () => {
    for (const [file, digest] of Object.entries(MANIFESTS)) expect(sha(file)).toBe(digest);
    expect(Object.keys(PACKAGE_DIGESTS)).toHaveLength(2);
  });

  it('R1: the eight accepted source/spec files', () => {
    const entries = srcEntries('G-R1-MANIFEST.sha256');
    expect(entries.map(([f]) => f).sort()).toEqual([
      'ask-context-producers.contract.ts',
      'corpus.ts',
      'effective-context.spec.ts',
      'effective-context.ts',
      'office-geography.producer.ts',
      'producers.spec.ts',
      'reader-topic.producer.ts',
      'stated-period.producer.ts',
    ]);
    for (const [file, hash] of entries) expect({ file, hash: sha(file) }).toEqual({ file, hash });
  });

  it('FINAL ADDENDUM: the v2 eligibility rule, its contract, corpus and spec', () => {
    const entries = srcEntries('G-FINAL-ADDENDUM-MANIFEST.sha256');
    expect(entries.map(([f]) => f).sort()).toEqual([
      'addendum.contract.ts',
      'corpus-addendum.ts',
      'inherited-context-eligibility.spec.ts',
      'inherited-context-eligibility.ts',
    ]);
    for (const [file, hash] of entries) expect({ file, hash: sha(file) }).toEqual({ file, hash });
  });
});

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * THE NEGATIVE CONTROL FOR SNAPSHOT R2 ADMISSION.
 *
 * R3.1's whole claim is that a Market retention CANNOT happen without a canonical
 * admission verdict. A claim like that is worth exactly as much as the demonstration
 * that removing the field breaks the build — otherwise "it is required" is a sentence
 * about a type, not a property of the repository.
 *
 * So this compiles two files that differ in ONE field:
 *
 *   WITH `admission`     -> must compile clean          (positive control)
 *   WITHOUT `admission`  -> must fail, naming the field (negative control)
 *
 * Without the positive control the negative one proves only that some file somewhere
 * failed to compile, which is not the same claim at all.
 *
 * No mock, no stub, no jest magic: the real `tsc`, the real project config, the real
 * seam. `tsc` is slow, so this lives in its own spec rather than slowing the suite.
 */

const BACKEND = resolve(__dirname, '..', '..', '..', '..');
/*
  THE COMPILER IS INVOKED THROUGH NODE, NOT THROUGH THE .bin SHIM.

  ALPHA-OFFICIAL-DATA-CANONICAL-ADMISSION-R1, recorded under GIT-GUARD-TOOLING-1.

  `node_modules/.bin/tsc` is an extensionless SHELL script; on Windows `execFileSync`
  cannot spawn it and throws ENOENT, and the sibling `tsc.cmd` throws EINVAL because
  current Node refuses to spawn a .cmd without a shell. Either way the catch block
  returned `{ ok: false, output: '' }` — so the POSITIVE control failed, and the
  NEGATIVE control "passed" the ok===false assertion FOR THE WRONG REASON, having never
  run the compiler at all.

  That is the precise failure mode §10 warns about, reached by accident rather than by
  a try/catch someone added: a guard that cannot execute must not read as a result. The
  fix runs TypeScript's own JS entry point under the current Node binary, which is
  platform-independent and involves no shell — so the control now actually compiles
  something, on every platform, and can fail honestly.
*/
const TSC_ENTRY = resolve(BACKEND, '..', 'node_modules', 'typescript', 'bin', 'tsc');

const PROBE = (withAdmission: boolean): string => `
import { retainMarketResponse } from '${join(__dirname, 'market-snapshot.seam').replace(/\\/g, '/')}';
import type { MarketSnapshotRetainPort } from '${join(__dirname, 'market-snapshot.seam').replace(/\\/g, '/')}';
import type { PermittedProvider } from '${join(__dirname, '..', 'market-provider-registry').replace(/\\/g, '/')}';
import type { SnapshotAdmissionRecord } from '@globalnews-ai/shared';

declare const port: MarketSnapshotRetainPort;
declare const provider: PermittedProvider;
declare const admission: SnapshotAdmissionRecord;

void retainMarketResponse(port, {
  provider,
  endpointId: 'probe',
  request: { method: 'GET', url: 'https://example.invalid/x', accept: 'application/json', query: {} },
  response: {
    status: 200,
    contentType: 'application/json',
    body: '{}',
    headers: {},
    byteLength: 2,
    wireBytes: new Uint8Array([123, 125]),
    contentEncodingHeader: 'identity',
  },
  retrievalId: 'r1',
  requestedAt: '2026-09-19T00:00:00Z',
  retrievedAt: '2026-09-19T00:00:00Z',
  editionAnnotations: {},
${withAdmission ? '  admission,\n' : ''}});
`;

function compile(withAdmission: boolean): { ok: boolean; output: string } {
  // The probe lives OUTSIDE the repository so nothing has to be deleted from a
  // connected folder afterwards, and a generated tsconfig points `@globalnews-ai/shared`
  // at the built declarations so resolution matches the real build.
  const dir = mkdtempSync(join(tmpdir(), 'mkt-admission-'));
  const file = join(dir, 'probe.ts');
  const shared = resolve(BACKEND, '..', 'shared', 'dist', 'index.d.ts').replace(/\\/g, '/');

  writeFileSync(file, PROBE(withAdmission), 'utf-8');
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: true,
        target: 'es2022',
        module: 'commonjs',
        moduleResolution: 'node',
        skipLibCheck: true,
        types: [],
        baseUrl: '.',
        paths: { '@globalnews-ai/shared': [shared] },
      },
      files: ['probe.ts'],
    }),
    'utf-8',
  );

  try {
    execFileSync(process.execPath, [TSC_ENTRY, '--noEmit', '-p', dir], {
      cwd: BACKEND,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { ok: true, output: '' };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('R3-1-NC · removing the admission verdict must break the build', () => {
  it('POSITIVE CONTROL · with `admission` the seam compiles', () => {
    const result = compile(true);
    expect([result.ok, result.output]).toEqual([true, '']);
  }, 180_000);

  it('NEGATIVE CONTROL · without `admission` the seam does NOT compile, and says why', () => {
    const result = compile(false);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/admission/);
    expect(result.output).toMatch(/TS(2345|2741|2739)/);
  }, 180_000);
});

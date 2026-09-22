/** Offline operator admission; not registered in Nest or reachable from a reader. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { sha256, validateBundle } from './election-validation';

export function admitElectionBundle(
  candidate: unknown,
  output: string,
  approvedBundleSha256: string,
  approvedTlsFingerprint: string,
): string {
  const bundle = validateBundle(candidate);
  const bytes = Buffer.from(JSON.stringify(bundle, null, 2) + '\n');
  if (
    sha256(bytes) !== approvedBundleSha256 ||
    bundle.artifacts.some((a) => a.tlsPeerFingerprint256 !== approvedTlsFingerprint)
  )
    throw new Error('ELECTION_WITHHELD: reviewed digest or TLS identity mismatch');
  mkdirSync(output, { recursive: true });
  const file = `${approvedBundleSha256}.json`;
  // Append-only: an existing capture cannot be overwritten by admission.
  writeFileSync(join(output, file), bytes, { flag: 'wx' });
  return file;
}
if (require.main === module) {
  const [candidate, output, digest, fingerprint] = process.argv.slice(2);
  if (!candidate || !output || !digest || !fingerprint)
    throw new Error(
      'Usage: admit CANDIDATE OUTPUT APPROVED_BUNDLE_SHA256 APPROVED_TLS_FINGERPRINT',
    );
  process.stdout.write(
    admitElectionBundle(JSON.parse(readFileSync(candidate, 'utf8')), output, digest, fingerprint) +
      '\n',
  );
}

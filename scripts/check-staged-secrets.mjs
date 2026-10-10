#!/usr/bin/env node
/*
  E1-TAA-6 — STAGED-FILE SECRET CHECK. Fails (exit 1) when the index contains an environment file
  other than a documented `.env.example`, or staged text that looks like a credential. Prints file
  names and the rule matched — never the matched value. Run: `node scripts/check-staged-secrets.mjs`
  (also wired as .githooks/pre-commit; enable with `git config core.hooksPath .githooks`).
*/
import { execFileSync } from 'node:child_process';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);

const ENV_FILE = /(^|\/)\.env($|\.)/;
const ALLOWED_ENV = /(^|\/)\.env\.example$/;
const CONTENT_RULES = [
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['OpenAI-style secret key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['assigned secret variable', /^\s*(?:export\s+)?[A-Z0-9_]*(?:SECRET|PASSWORD|API_KEY|TOKEN|PRIVATE_KEY|DATABASE_URL)[A-Z0-9_]*\s*=\s*['"]?[^\s'"#]{8,}/m],
];

const problems = [];
for (const file of staged) {
  if (ENV_FILE.test(file) && !ALLOWED_ENV.test(file)) {
    problems.push(`${file}: environment file (only .env.example may be committed)`);
    continue;
  }
  let text;
  try {
    text = git(['show', `:${file}`]);
  } catch {
    continue;
  }
  if (text.includes('\0')) continue; // binary
  for (const [rule, pattern] of CONTENT_RULES) {
    if (ALLOWED_ENV.test(file) && rule === 'assigned secret variable') continue; // placeholders
    if (pattern.test(text)) problems.push(`${file}: ${rule}`);
  }
}

if (problems.length > 0) {
  console.error(`Staged-secret check FAILED (values not shown):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Staged-secret check passed (${staged.length} staged file(s)).`);

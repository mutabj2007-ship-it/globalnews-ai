/* Verify the user-specified base remains the visual authority, allowing only named text bindings. */
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = 'e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a';
const files = [
  'frontend/src/components/humanitarian/HumanitarianScreen.tsx',
  'frontend/src/components/humanitarian/HumanitarianCompactScreen.tsx',
  'frontend/src/components/security/SecurityScreen.tsx',
  'frontend/src/components/security/SecurityCompactScreen.tsx',
  'frontend/src/components/security/SecParts.tsx',
];
for (const file of files) {
  const expected = execFileSync('git', ['show', `${base}:${file}`], {
    cwd: root,
    encoding: 'utf8',
  }).replaceAll('\r\n', '\n');
  const actual = readFileSync(path.join(root, file), 'utf8')
    .replaceAll('\r\n', '\n')
    .replace(
      'import { humanitarianReadLabel, humanitarianReadExplanation }',
      'import { humanitarianReadLabel }',
    )
    .replace('{humanitarianReadExplanation(retainedRead, locale)}', '{t.assessment.noAssessment}')
    .replace('<ZoneA0 locale={locale} />', '<ZoneA0 />')
    .replace("import type { SecLocale } from '@/lib/security/securityStrings';\n", '')
    .replace(
      "import { securityPublicReadExplanation } from '@/lib/security/securityPublicReadLabel';\n",
      '',
    )
    .replace(
      "export function ZoneA0({ locale = 'en' }: { locale?: SecLocale }): JSX.Element {",
      'export function ZoneA0(): JSX.Element {',
    )
    .replace(
      '{securityAbsenceLabel(SECURITY_ABSENCE_FALLBACK)} {securityPublicReadExplanation(locale)}',
      '{securityAbsenceLabel(SECURITY_ABSENCE_FALLBACK)}',
    );
  assert.equal(actual, expected, `${file}: unexpected structural/style change`);
}
const unchanged = [
  'frontend/src/app/humanitarian/page.tsx',
  'frontend/src/app/humanitarian/compact/page.tsx',
  'frontend/src/app/security-visual-preview/page.tsx',
  'frontend/src/app/security-visual-preview/compact/page.tsx',
  'frontend/src/components/navigation/NavBar.tsx',
  'frontend/src/components/navigation/sharedReturnControl.spec.ts',
  'frontend/src/lib/security/securityZones.ts',
  'frontend/src/lib/security/securityVisualFrame.spec.ts',
  'frontend/src/lib/humanitarian/humContract.spec.ts',
  'frontend/src/lib/humanitarian/humAxes.ts',
  'frontend/src/lib/humanitarian/humState.ts',
  'frontend/src/lib/humanitarian/humTokens.ts',
  'frontend/src/components/humanitarian/HumParts.tsx',
  'frontend/src/components/humanitarian/HumDrawer.tsx',
];
assert.equal(
  execFileSync('git', ['diff', base, '--', ...unchanged], { cwd: root, encoding: 'utf8' }),
  '',
);
console.log(
  `PASS: ${files.length} visual files differ only by permitted text bindings; ${unchanged.length} routes/guards/geometry files unchanged.`,
);

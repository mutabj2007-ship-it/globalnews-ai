import { classifySecurityCandidate } from './security-candidate.classifier';
describe('R2 independent-audit regressions', () => {
  test.each([
    'Police said a shooting occurred; the attackers have not been identified.',
    'Police said no shooting occurred.',
    'Police said five people were killed in a bus crash.',
    'Police are investigating a shooting.',
    'A suspect was arrested after gunfire.',
    'A shooting was committed by a lone individual.',
    'A shooting was committed by an unaffiliated individual acting alone, police denied the report.',
    'A shooting may have been committed by an unaffiliated individual acting alone.',
    'A shooting was committed by an unaffiliated individual acting alone in a simulation.',
    'Police said people were wounded in an industrial accident.',
    'Police said three people drowned.',
    'Police said no arson occurred.',
    'An explosion was a false report.',
    'Rumours of a shooting were unconfirmed.',
    '',
  ])('does not promote unsupported text: %s', (title) => {
    expect(classifySecurityCandidate({ title, summary: '' }).verdict).not.toBe(
      'ADMITTED_TO_SECURITY',
    );
  });
  test('an attribution cannot decide T2', () => {
    expect(
      classifySecurityCandidate({ title: 'Police said a shooting occurred.', summary: '' })
        .ownership.organisedArmedActorParticipates,
    ).toBeUndefined();
  });
  test('explicit unaffiliated participation permits Security', () => {
    expect(
      classifySecurityCandidate({
        title: 'A shooting was committed by an unaffiliated individual acting alone.',
        summary: '',
      }).verdict,
    ).toBe('ADMITTED_TO_SECURITY');
  });
  test('organised armed participation has precedence', () => {
    expect(
      classifySecurityCandidate({ title: 'Army troops opened fire.', summary: '' }).verdict,
    ).toBe('EXCLUDED_TO_CONFLICT');
  });
});

import { readFileSync } from 'fs';
import { join } from 'path';
import { supportEn } from '@/lib/i18n/dictionaries/supportEn';
import { supportPl } from '@/lib/i18n/dictionaries/supportPl';
import { adminEn } from '@/lib/i18n/dictionaries/adminEn';
import { adminPl } from '@/lib/i18n/dictionaries/adminPl';

/**
 * SUPPORT-AI-1 — what the two surfaces may and may not do with a
 * machine-authored message.
 *
 * The user surface must make it obvious that a machine wrote the reply.
 * The admin surface must show the operator exactly what the requester was
 * told, so they never answer on top of a reply they cannot see. And
 * neither may render a locally-composed imitation of an answer while the
 * real one is still being stored.
 */
const COMPONENTS = join(__dirname);
const LIB = join(__dirname, '..', '..', 'lib');
const ADMIN_SCREEN = join(__dirname, '..', 'admin', 'screens', 'SupportScreen.tsx');

const read = (path: string): string => readFileSync(path, 'utf-8');
const stripComments = (value: string): string =>
  value
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const form = read(join(COMPONENTS, 'NewSupportRequestForm.tsx'));
const screen = read(join(COMPONENTS, 'SupportScreen.tsx'));
const thread = read(join(COMPONENTS, 'SupportThread.tsx'));
const hook = read(join(LIB, 'support', 'useSupportApi.ts'));

describe('SUPPORT-AI-1 — the agent is visibly a machine, on both surfaces', () => {
  it('the user-facing label names the agent', () => {
    expect(supportEn.authors.SYSTEM_AI).toContain('GlobalNews AI Support Agent');
    expect(supportPl.authors.SYSTEM_AI).toContain('Agent wsparcia GlobalNews AI');
  });

  it('the agent label is DISTINGUISHABLE from the human one, not merely different', () => {
    // Both mention GlobalNews AI, so inequality alone would pass while a
    // reader still could not tell a person from a machine.
    expect(supportEn.authors.SYSTEM_AI).not.toBe(supportEn.authors.ADMIN);
    expect(supportEn.authors.SYSTEM_AI).toMatch(/automated/i);
    expect(supportEn.authors.ADMIN).not.toMatch(/automated|agent/i);

    expect(supportPl.authors.SYSTEM_AI).toMatch(/automatycznie/i);
    expect(supportPl.authors.ADMIN).not.toMatch(/automatycznie|agent/i);
  });

  it('the ADMIN surface labels it too, so an operator sees what the requester was told', () => {
    expect(adminEn.screens.support.authors.SYSTEM_AI).toContain('GlobalNews AI Support Agent');
    expect(adminPl.screens.support.authors.SYSTEM_AI.length).toBeGreaterThan(0);
    expect(adminPl.screens.support.authors.SYSTEM_AI).not.toBe(
      adminEn.screens.support.authors.SYSTEM_AI,
    );
    // And it is not the same label a human administrator gets.
    expect(adminEn.screens.support.authors.SYSTEM_AI).not.toBe(
      adminEn.screens.support.authors.ADMIN,
    );
  });

  it('both threads render the author of EVERY message from the stored type', () => {
    expect(thread).toContain('t.authors[entry.authorType]');
    expect(read(ADMIN_SCREEN)).toContain('screen.authors[message.authorType]');
  });

  it('the admin thread applies no visibility filter of its own — the server decides', () => {
    // The operator sees the SYSTEM_AI message because it is PUBLIC and the
    // admin read returns everything; nothing here selects author types.
    const admin = stripComments(read(ADMIN_SCREEN));
    expect(admin).not.toMatch(/authorType !== 'SYSTEM_AI'/);
    expect(admin).not.toMatch(/filter\([^)]*SYSTEM_AI/);
  });
});

describe('SUPPORT-AI-1 — the visible reply is the STORED one', () => {
  it('the form composes no reply text of its own', () => {
    const executable = stripComments(form);

    // A progress line is allowed. A drafted, guessed or previewed ANSWER is
    // not: the message the person reads has to be the record.
    expect(executable).toContain('t.form.sendingNotice');
    expect(executable).not.toMatch(/SYSTEM_AI/);
    expect(executable).not.toMatch(/authorType:/);
  });

  it('the progress line is a status, and it is TRANSIENT — never a stored message', () => {
    expect(form).toContain('role="status"');
    // It renders only while the submission is in flight, so it cannot
    // survive as a permanent entry in the conversation.
    expect(stripComments(form)).toMatch(/\{mutation\.pending && \(/);
  });

  it('R4 SUPPORT UX CLOSURE — the progress line claims NO agent work', () => {
    /*
      It used to say the GlobalNews AI Support Agent was reviewing the
      request. Six of the seven categories now never reach the agent, so
      on those that was a claim about work nobody was doing. The line
      says only that the request is being sent.
    */
    [supportEn.form.sendingNotice, supportPl.form.sendingNotice].forEach((notice) => {
      expect(notice).not.toMatch(/agent/i);
      expect(notice).not.toMatch(/GlobalNews AI/);
      expect(notice).not.toMatch(/review|analys|sprawdza|przegląda|analiz/i);
    });

    expect(supportEn.form.sendingNotice.length).toBeGreaterThan(0);
    expect(supportPl.form.sendingNotice).not.toBe(supportEn.form.sendingNotice);

    // And the key that carried the old claim is gone, not merely retexted
    // around, so nothing can reintroduce it under the name that used to
    // hold it.
    expect(Object.keys(supportEn.form)).not.toContain('agentWorking');
    expect(Object.keys(supportPl.form)).not.toContain('agentWorking');
  });

  it('the created THREAD is handed up and opened, so no second read is needed', () => {
    expect(stripComments(form)).toContain('onCreated(created)');
    expect(stripComments(screen)).toContain('setOpenReference(created.reference)');
  });

  it('the fields clear ONLY on a stored ticket', () => {
    const after = stripComments(form).slice(
      stripComments(form).indexOf('const created = await mutation.submit('),
    );
    expect(after).toMatch(/if \(created\) \{[\s\S]*?setMessage\(''\)/);
  });
});

describe('SUPPORT-AI-1 — one submission, one ticket', () => {
  it('the in-flight latch is a ref, checked before anything else', () => {
    expect(hook).toContain('const inFlight = useRef(false)');
    const submit = hook.slice(hook.indexOf('const submit ='));
    expect(submit).toMatch(/if \(inFlight\.current\) return null;/);
    // Checked before the state change, or a second click in the same tick
    // would slip past.
    expect(submit.indexOf('inFlight.current')).toBeLessThan(submit.indexOf("setState('pending')"));
  });

  it('the submit control is disabled while a submission is in flight', () => {
    expect(form).toMatch(/disabled=\{mutation\.pending\}/);
    expect(stripComments(form)).toContain('!mutation.pending');
  });

  it('a response that will not parse is a FAILURE, not an empty success', () => {
    const submit = hook.slice(hook.indexOf('const submit ='));
    const rescue = submit.slice(submit.indexOf('} catch {'));
    expect(rescue).toContain("setState('error')");
    expect(rescue).toContain('return null');
  });
});

describe('SUPPORT-AI-1 — the language reaches the server as data', () => {
  it('the page resolves it once and passes it down', () => {
    const page = read(join(__dirname, '..', '..', 'app', 'support', 'page.tsx'));
    expect(stripComments(page)).toMatch(/currentLanguage\(\) === 'pl' \? 'pl' : 'en'/);
    expect(stripComments(page)).toContain('language={language}');
  });

  it('the form sends it with the request rather than inventing one', () => {
    const executable = stripComments(form);
    expect(executable).toMatch(/language,\s*\}\);/);
    expect(executable).not.toMatch(/navigator\.language/);
    expect(executable).not.toMatch(/Intl\./);
  });
});

describe('SUPPORT-AI-1 — EN and PL stay complete', () => {
  it('every support key exists in both languages', () => {
    const keys = (value: unknown, prefix = ''): string[] =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [
            `${prefix}${key}`,
            ...keys(nested, `${prefix}${key}.`),
          ])
        : [];

    expect(keys(supportPl).sort()).toEqual(keys(supportEn).sort());
  });

  it('no new support string was left untranslated', () => {
    const untranslated = (['sendingNotice'] as const).filter(
      (key) => supportPl.form[key] === supportEn.form[key],
    );
    expect(untranslated).toEqual([]);
    expect(supportPl.authors.SYSTEM_AI).not.toBe(supportEn.authors.SYSTEM_AI);
  });
});

import type { AskV2Operation } from '@/lib/api/askV2Api';
import {
  ageText,
  finishedCheckTurn,
  followCheckHref,
  FOLLOW_RECHECK_MINUTES,
  isFollowedQuestion,
  MY_UPDATES_HREF,
  recheckWaitMinutes,
} from './followedQuestions';
import { followStrings, followStringsQualified } from './followStrings';
import { isStandalonePath } from '@/lib/routing/standaloneRouteGate';

const s = followStrings('en');
const NOW = new Date('2026-10-09T12:00:00Z');

describe('REASON TO RETURN R1 — followed-question helpers', () => {
  it('only Ask-question briefings are followed questions', () => {
    expect(isFollowedQuestion({ scope: { kind: 'ASK_QUESTION', question: 'Q?' } })).toBe(true);
    expect(isFollowedQuestion({ scope: { kind: 'STORY', storyId: 's' } })).toBe(false);
  });

  it('the baseline age is stated, never rounded up to fresh', () => {
    expect(ageText('2026-10-06T12:00:00Z', NOW, s)).toBe('3 days ago');
    expect(ageText('2026-10-09T07:00:00Z', NOW, s)).toBe('5 hours ago');
    expect(ageText('2026-10-09T11:40:00Z', NOW, s)).toBe('just now');
    expect(ageText(null, NOW, s)).toBeNull();
    expect(ageText('not a date', NOW, s)).toBeNull();
  });

  it('a re-check is offered again only after the guard window', () => {
    expect(recheckWaitMinutes(null, NOW)).toBe(0);
    expect(recheckWaitMinutes('2026-10-09T11:57:00Z', NOW)).toBe(FOLLOW_RECHECK_MINUTES - 3);
    expect(recheckWaitMinutes('2026-10-09T11:00:00Z', NOW)).toBe(0);
  });

  it('the check turn is the first finished turn after arrival that asks the followed question', () => {
    const op = (turnId: string, status: string) =>
      ({ operationId: `op-${turnId}`, turnId, status }) as unknown as AskV2Operation;
    const turns = [
      { question: 'Fuel prices in Kenya?', operation: op('old', 'COMPLETED') },
      { question: 'Something else', operation: op('x', 'COMPLETED') },
      { question: ' Fuel prices in Kenya? ', operation: op('new', 'RUNNING') },
    ];
    /* the turn on screen at arrival never counts */
    expect(finishedCheckTurn(turns, 'Fuel prices in Kenya?', 1)).toBeNull();
    const done = [...turns.slice(0, 2), { question: 'Fuel prices in Kenya?', operation: op('new', 'COMPLETED') }];
    expect(finishedCheckTurn(done, 'Fuel prices in Kenya?', 1)?.operation?.turnId).toBe('new');
    /* a released (failed) turn still finishes the check — the server records it as incomplete */
    const failed = [{ question: 'Fuel prices in Kenya?', operation: op('f', 'RELEASED') }];
    expect(finishedCheckTurn(failed, 'Fuel prices in Kenya?', 0)?.operation?.turnId).toBe('f');
  });

  it('the check address carries an id only, never the question text', () => {
    expect(followCheckHref('b1d2')).toBe('/ask?follow=b1d2');
  });

  it('My updates and saved answers are served by the Standalone route gate', () => {
    expect(isStandalonePath(MY_UPDATES_HREF)).toBe(true);
    expect(isStandalonePath('/saved/briefing')).toBe(true);
  });
});

describe('REASON TO RETURN R1 — copy', () => {
  it('EN and PL carry exactly the same keys and every outcome', () => {
    const en = followStrings('en');
    const pl = followStrings('pl');
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(pl.outcome).sort()).toEqual(Object.keys(en.outcome).sort());
    expect(Object.keys(pl.outcomeDetail).sort()).toEqual(Object.keys(en.outcomeDetail).sort());
  });

  it('the five unqualified locales are reported, not passed off as translated', () => {
    for (const l of ['fr', 'de', 'es', 'pt', 'ar']) expect(followStringsQualified(l)).toBe(false);
    expect(followStringsQualified('en')).toBe(true);
    expect(followStringsQualified('pl')).toBe(true);
  });

  it('an incomplete check never reads as "nothing changed", and nothing manufactures urgency', () => {
    for (const locale of ['en', 'pl']) {
      const t = followStrings(locale);
      expect(t.outcomeDetail.INCOMPLETE_CHECK).not.toMatch(/^no (new )?change/i);
      for (const text of Object.values(t.outcome)) expect(text).not.toMatch(/urgent|breaking|alert|!/i);
    }
    expect(followStrings('en').outcomeDetail.INCOMPLETE_CHECK).toMatch(/not a “nothing changed”/);
  });
});

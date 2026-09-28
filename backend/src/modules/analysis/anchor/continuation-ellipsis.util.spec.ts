import { readContinuationEllipsis } from './continuation-ellipsis.util';

/** ASK R2 ALPHA ENABLEMENT R1 · MC-070 — the closed continuation-ellipsis reader. */
describe('a continuation that names only a place is read, EN and PL', () => {
  it.each([
    ['And Kenya?', ['KEN']],
    ['What about Kenya?', ['KEN']],
    ['How about in Kenya?', ['KEN']],
    ['And Kenya and Uganda?', ['KEN', 'UGA']],
    ['And the US?', ['USA']],
    ['A Kenia?', ['KEN']],
    ['A co z Kenią?', ['KEN']],
    ['Co z Kenią?', ['KEN']],
    ['A w Kenii?', ['KEN']],
    ['A Kenia i Uganda?', ['KEN', 'UGA']],
  ])('%s → %j', (q, candidates) => {
    expect(readContinuationEllipsis(q)).toEqual({ candidates });
  });
});

describe('a question that names its own subject is never caught', () => {
  it.each([
    'And what is happening in Kenya?',
    'What about inflation in Poland?',
    'What about businesses?',
    'And it?',
    'And us?',
    'A recession?',
    'Kenya',
    'Tell me about Kenya',
    'What is happening in Kenya?',
    'Co dzieje się w Kenii?',
    'And Kenya’s election results last week?',
    '',
  ])('%s → null', (q) => {
    expect(readContinuationEllipsis(q)).toBeNull();
  });
});

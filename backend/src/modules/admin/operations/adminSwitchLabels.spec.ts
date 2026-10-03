import { OPERATIONAL_SWITCHES } from '../../compute-controls/operational-switch.service';
import { ADMIN_SWITCH_LABEL_KEYS } from './admin-operations.contract';

/**
 * TRUST R1 (CTO checkpoint 4 §7) — every landed switch has its own operator label. The guest
 * switch used to fall through to the Ask R2 label ("Stop Ask R2 execution").
 */
describe('Admin Operations — one distinct label per landed switch', () => {
  it('covers exactly the landed switches, no more', () => {
    expect(Object.keys(ADMIN_SWITCH_LABEL_KEYS).sort()).toEqual([...OPERATIONAL_SWITCHES].sort());
  });

  it('never shares a label between two switches', () => {
    const labels = Object.values(ADMIN_SWITCH_LABEL_KEYS);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('the guest switch is guestTrial, never the Ask R2 wording', () => {
    expect(ADMIN_SWITCH_LABEL_KEYS.ASK_GUEST_TRIAL_ENABLED).toBe('guestTrial');
    expect(ADMIN_SWITCH_LABEL_KEYS.ASK_R2_ENABLED).toBe('stopAskR2Execution');
    expect(ADMIN_SWITCH_LABEL_KEYS.ASK_PUBLIC_COMPUTE_ENABLED).toBe('pauseNewAiAnswers');
  });
});

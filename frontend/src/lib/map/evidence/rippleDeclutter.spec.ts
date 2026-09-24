import { declutterProjectedRipples } from './rippleDeclutter';

const r = (id: string, x: number, y: number) => ({ id, x, y, amber: false });

describe('declutterProjectedRipples', () => {
  it('keeps every ripple at local zoom', () => {
    const rows = [r('a', 10, 10), r('b', 12, 12), r('c', 80, 80)];
    expect(declutterProjectedRipples(rows, 5, 26)).toEqual(rows);
    expect(declutterProjectedRipples(rows, 8, 26)).toEqual(rows);
  });

  it('suppresses only overlapping animation at regional zoom', () => {
    const rows = [r('a', 10, 10), r('b', 20, 20), r('c', 80, 80)];
    expect(declutterProjectedRipples(rows, 4, 26).map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('uses a wider collision radius at world zoom', () => {
    const rows = [r('a', 10, 10), r('b', 40, 10), r('c', 80, 10)];
    expect(declutterProjectedRipples(rows, 2, 26).map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('never mutates or invents positions', () => {
    const rows = [r('a', 10, 10), r('b', 90, 90)];
    const out = declutterProjectedRipples(rows, 2, 26);
    expect(out).toEqual(rows);
    expect(out[0]).toBe(rows[0]);
    expect(out[1]).toBe(rows[1]);
  });
});

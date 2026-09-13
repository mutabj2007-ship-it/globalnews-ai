import { readFileSync } from 'fs';
import { join } from 'path';

const desktopSource = readFileSync(join(__dirname, 'HeroWorldVisual.tsx'), 'utf-8');
const mobileSource = readFileSync(join(__dirname, 'HeroWorldVisualMobile.tsx'), 'utf-8');

describe('Hero world visuals are fully screen-reader-safe (accessibility pass)', () => {
  it('the desktop visual\u2019s OUTER container is aria-hidden \u2014 a real gap found and fixed this round (inner elements alone were not enough)', () => {
    const outerDivMatch = desktopSource.match(/return \(\s*<div\s+([\s\S]*?)>/);
    expect(outerDivMatch).not.toBeNull();
    expect(outerDivMatch![1]).toMatch(/aria-hidden="true"/);
  });

  it('the mobile visual\u2019s outer container is also aria-hidden', () => {
    expect(mobileSource).toMatch(/<div aria-hidden="true" className="relative h-full w-full overflow-hidden rounded-xl/);
  });
});

import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'LiveStatusStrip.tsx'), 'utf-8');

describe('LiveStatusStrip HUD color treatment (CTO Frontend Visual Revision)', () => {
  it('uses emerald when genuinely live, amber otherwise — per the explicit color spec', () => {
    expect(source).toMatch(/isReallyLive \? 'bg-emerald-500\/10' : 'bg-amber-500\/10'/);
    expect(source).toMatch(/isReallyLive \? 'bg-emerald-400' : 'bg-amber-400'/);
  });

  it('never claims LIVE unless both the fetch succeeded AND the backend reports dataMode live', () => {
    expect(source).toMatch(/const isReallyLive = isLive && dataMode === 'live'/);
  });

  it('the animated ping indicator only renders when genuinely live', () => {
    expect(source).toMatch(/\{isReallyLive && \(/);
  });

  it('uses the wider frame-utilization max-width, consistent with the rest of the revised page', () => {
    expect(source).toMatch(/max-w-\[1480px\]/);
  });
});

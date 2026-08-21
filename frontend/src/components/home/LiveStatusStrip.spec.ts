import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'LiveStatusStrip.tsx'), 'utf-8');

describe('LiveStatusStrip HUD color treatment (CTO Frontend Visual Revision)', () => {
  it('uses the approved Claude Design green live-state treatment and amber otherwise — a non-live state is never dressed as live', () => {
    // M65 — the exact colour tokens are the recovered design's own
    // (rgba(52,211,153,.45) / #34d399 for live, amber for everything
    // else). The BEHAVIOUR this test protects is unchanged: the two
    // treatments are still selected by isReallyLive, never by anything
    // weaker.
    expect(source).toMatch(/isReallyLive\s*\n?\s*\? 'border-\[rgba\(52,211,153,0\.45\)\]/);
    expect(source).toMatch(/isReallyLive \? 'bg-\[#34d399\]' : 'bg-amber-400'/);
  });

  it('never claims LIVE unless both the fetch succeeded AND the backend reports dataMode live', () => {
    // M65 — the derivation moved verbatim into the shared, unit-tested
    // resolveLiveStatus() so this strip and the Hero DATA STATUS row can
    // never drift apart. The invariant is now asserted at its real
    // location (lib/liveStatus.spec.ts) AND here, at the call site.
    expect(source).toMatch(/resolveLiveStatus\(isLive, dataMode, language, updatedAt\)/);
    expect(source).toMatch(/const \{ isReallyLive, badgeText, lastUpdated \}/);
  });

  it('renders on mobile only — the desktop equivalent is the Hero DATA STATUS row, driven by the same function, so no status information is lost', () => {
    expect(source).toMatch(/lg:hidden/);
  });

  it('the monitoring line is RETAINED per explicit CTO decision — the recovered archive dropped it; that deletion is not carried', () => {
    expect(source).toMatch(/\{t\.monitoring\}/);
  });

  it('never manufactures its own timestamp — updatedAt is supplied by the Server Component', () => {
    expect(source).toMatch(/updatedAt: string;/);
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/new Date\(\)/);
  });

  it('the animated ping indicator only renders when genuinely live', () => {
    expect(source).toMatch(/\{isReallyLive && \(/);
  });

  it('uses the wider frame-utilization max-width, consistent with the rest of the revised page', () => {
    expect(source).toMatch(/max-w-\[1480px\]/);
  });
});

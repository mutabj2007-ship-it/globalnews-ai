import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const dockSource = readFileSync(join(ROOT, 'components', 'ask', 'AskAiDock.tsx'), 'utf-8');
const clientSource = readFileSync(join(__dirname, 'MyIntelligenceClient.tsx'), 'utf-8');
const selectionSource = readFileSync(join(__dirname, 'MiSelection.tsx'), 'utf-8');

/*
  RULING 1 — THE FLOATING ASK LAUNCHER YIELDS ON /my-intelligence, AND
  NOTHING ELSE DOES.

  The Product Owner froze the My Intelligence Select control, so the control
  does not move. The collision is caused by later global Ask chrome that the
  R1.2 frames were drawn without, so that chrome is what gives way — and only
  the standalone floating button, never the dock, the open event, the story
  hand-off or any explicit action.

  These assertions read the source rather than a rendered tree because what is
  being protected is a CONTRACT about which single element is conditional. A
  render test would prove the button is absent on one route; it would not stop
  someone later moving the conditional up a level and taking the panel with it.
  The measured, in-browser proof that the collision is actually closed at 360,
  390 and 430 is the capture harness's geometry assertion, reported alongside.
*/

describe('Ruling 1 — the floating Ask launcher is suppressed on /my-intelligence only', () => {
  it('the suppression is keyed on an explicit route set, not a scattered condition', () => {
    expect(dockSource).toContain('LAUNCHER_SUPPRESSED_ROUTES');
    expect(dockSource).toMatch(/LAUNCHER_SUPPRESSED_ROUTES[^=]*=\s*new Set\(\['\/my-intelligence'\]\)/);
  });

  it('only the launcher BUTTON is conditional — the panel is not', () => {
    const gateAt = dockSource.indexOf('{showLauncher && (');
    const buttonAt = dockSource.indexOf('data-ask="launcher"');
    const panelAt = dockSource.indexOf('data-ask="panel"');
    const closeAt = dockSource.indexOf('</button>\n      )}');

    expect(gateAt).toBeGreaterThan(-1);
    /* the gate opens before the button ... */
    expect(gateAt).toBeLessThan(buttonAt);
    /* ... and closes before the panel, so the panel is never inside it. */
    expect(closeAt).toBeGreaterThan(buttonAt);
    expect(closeAt).toBeLessThan(panelAt);
  });

  it('the dock stays mounted and stays listening, so intentional opens still work', () => {
    /* Unmounting is what /ask does, and it is NOT what this route does. */
    const askRouteGuard = dockSource.indexOf('if (pathname === ASK_CANONICAL_ROUTE) return null;');
    expect(askRouteGuard).toBeGreaterThan(-1);
    expect(dockSource).not.toContain("if (pathname === '/my-intelligence') return null");
    /* The open event survives — this is what "Ask about selected" rides on. */
    expect(dockSource).toContain('GLOBAL_ASK_OPEN_EVENT');
    expect(dockSource).toContain('window.addEventListener(GLOBAL_ASK_OPEN_EVENT');
  });

  it('every other route keeps the launcher', () => {
    expect(dockSource).toContain("showLauncher={!LAUNCHER_SUPPRESSED_ROUTES.has(pathname ?? '')}");
    expect(dockSource).toContain('showLauncher = true');
  });

  it('the frozen Select control was not moved to make room', () => {
    /* Phone: the Select toggle sits in the eyebrow row, as R1.2 froze it. */
    expect(clientSource).toContain('md:hidden');
    expect(clientSource).toMatch(/\{selecting \? t\.done : t\.select\}/);
  });

  it('the six actions and the explicit confirmation are untouched by the suppression', () => {
    expect(selectionSource).toContain('MI_ACTIONS');
    expect(selectionSource).toContain('ComputeCommitSheet');
    /* Run / Send — never "Open" — remains the only thing that starts compute. */
    expect(selectionSource).toContain('t.send');
    expect(selectionSource).toContain('t.run');
  });
});

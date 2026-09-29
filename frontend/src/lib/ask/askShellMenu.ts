/**
 * THE ASK-SHELL MENU CONTRACT — deliberately four fields, deliberately not a node.
 *
 * The first iteration of this integration gave `AskFrameScreen` a
 * `navSlot?: React.ReactNode`. CTO refused it, correctly: a generic slot lets
 * ANY caller render ANY tree inside a frozen D25 header, so the surface's
 * composition would no longer be decided by the design authority at all. It is
 * an open door dressed as one prop.
 *
 * This is the narrow replacement. The frame receives DATA — a state flag, two
 * localized labels and a callback — and renders the control ITSELF, so what
 * appears in that header is fixed by the frame, not by whoever calls it. There
 * is no way to inject markup through this type.
 *
 * WHERE THE CONTROL GOES, AND WHY IT COSTS NO GEOMETRY. D25 draws the phone
 * header with three slots: a left control, a centred title, a right state
 * readout. Standalone Ask does not ADD a fourth — it REPLACES the left control
 * in the one case where that control is meaningless.
 *
 *   governed return destination exists  → the ruled Back/Close stays, untouched.
 *                                         The shell adds nothing and invents no
 *                                         navigation.
 *   no governed return destination      → "Close" would dismiss a standalone
 *                                         application to nowhere, so the slot
 *                                         carries the Ask menu trigger instead.
 *
 * Either way the header holds exactly three controls of the same sizes, the
 * title stays centred and the right-hand source/answer state is untouched.
 */
export interface AskShellMenuControl {
  /** Whether the shell's menu is currently open — drives `aria-expanded`. */
  readonly open: boolean;
  /** Localized accessible name while closed. */
  readonly openLabel: string;
  /** Localized accessible name while open. */
  readonly closeLabel: string;
  /** Toggles the shell's menu. Issues no request. */
  readonly onToggle: () => void;
}

/**
 * Minimal ambient declarations so the package compiles with ZERO dependencies.
 *
 * Deliberate: E1 measured the backend's whole dependency list and ruled that adding a
 * library is a supply-chain decision, not an implementation detail. A prototype that
 * needs `npm install` before it can be inspected is harder to review than one that
 * does not, so this package installs nothing.
 */
declare const process: {
  stdout: { write(s: string): boolean };
  exitCode: number | undefined;
};

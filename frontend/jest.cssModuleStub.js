/*
  ASK DESIGN COMPLETENESS R1 — CSS modules under jest.

  Jest runs the frontend's TypeScript only; a `*.module.css` import is not JavaScript. Specs that
  render the Ask frame already mocked its stylesheet by hand with exactly this shape (a Proxy
  that returns each class name as its own key). Shared Ask components (the Sources sheet, the
  answer toolbar, the toast, the conversations list) now import the Ask stylesheet too, and are
  rendered by dock and answer specs that never mocked it — so the same stub is mapped once,
  here, for every CSS module. A spec's own `jest.mock(...)` still takes precedence.
*/
module.exports = new Proxy(
  {},
  {
    get: (_target, key) => (key === '__esModule' ? false : String(key)),
  },
);

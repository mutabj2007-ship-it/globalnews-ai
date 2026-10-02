/**
 * HUMANITARIAN ASK TOOL — the single entry point canonical Ask V2 consults.
 *
 * ONE tool, consulted identically by Standalone Ask and by the Alpha dashboard context.
 * There is no second engine here, no chatbot, no model call and no provider.
 */

export * from './ports.js';
export { buildIdentity, readHumanitarian, resolveBinding, plannableForRead } from './reader.js';

/** The registry id. Codes only; the frontend owns every reader-facing word. */
export const HUMANITARIAN_TOOL_ID = 'specialist.humanitarian.retained-read';

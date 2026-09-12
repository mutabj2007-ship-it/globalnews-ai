import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * E1-N-7 — NO WEBSOCKET ENDPOINT UNDER ANY PROXIED PREFIX WITHOUT REVIEW.
 *
 * next.config.mjs configures the rewrite proxy with `ws: true`, so a WebSocket
 * route added under a proxied prefix would be carried automatically — it would
 * arrive as a discovery rather than a decision. Nothing exposes a WS route
 * today; E1 asked that this remain a decision, so it is asserted rather than
 * assumed.
 */
const BACKEND_SRC = join(__dirname, '..');

const WS_MARKERS = [
  { pattern: /@WebSocketGateway\b/, label: '@WebSocketGateway' },
  { pattern: /@WebSocketServer\b/, label: '@WebSocketServer' },
  { pattern: /@SubscribeMessage\b/, label: '@SubscribeMessage' },
  { pattern: /\bnew\s+WebSocketServer\b/, label: 'new WebSocketServer' },
  { pattern: /from\s+['"]@nestjs\/websockets['"]/, label: "@nestjs/websockets import" },
] as const;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function collect(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, acc);
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) acc.push(full);
  }
  return acc;
}

describe('E1-N-7 — no WebSocket route exists under a proxied prefix', () => {
  const files = collect(BACKEND_SRC);

  it('THE SWEEP IS ALIVE', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith('main.ts'))).toBe(true);
  });

  it('POSITIVE CONTROL: the scanner flags a deliberately non-compliant source', () => {
    const bad = `
      import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets';
      @WebSocketGateway({ path: '/news/live' })
      export class BadGateway {
        @WebSocketServer() server!: unknown;
        @SubscribeMessage('tick') onTick() { return null; }
      }
    `;
    const code = stripComments(bad);
    const hits = WS_MARKERS.filter(({ pattern }) => pattern.test(code)).map((m) => m.label);
    expect(hits.length).toBeGreaterThanOrEqual(4);
  });

  it.each(collect(BACKEND_SRC))('declares no WebSocket surface: %s', (file) => {
    const code = stripComments(readFileSync(file, 'utf-8'));
    const hits = WS_MARKERS.filter(({ pattern }) => pattern.test(code)).map((m) => m.label);
    expect(hits).toEqual([]);
  });
});

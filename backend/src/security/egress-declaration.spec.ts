import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import {
  DECLARED_EGRESS_MODE,
  egressDeclaration,
  EgressDeclarationReporter,
} from './egress-declaration';

/**
 * ASK R2 INTEGRATION R1 · §11 — egress mode as a value (F 07 T-23, T-24; F 04 EG-2, EG-3).
 * Implementation-facing: E1 verifies independently.
 */
const SRC = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'generated' ? [] : files(full);
    return /\.ts$/.test(name) && !/\.spec\.ts$/.test(name) ? [full] : [];
  });
}

describe('§11 egress declaration', () => {
  it('T-23: the declared mode is a runtime value — DIRECT, address-bound', () => {
    expect(DECLARED_EGRESS_MODE).toBe('DIRECT_ADDRESS_BOUND');
    expect(egressDeclaration()).toEqual({
      mode: 'DIRECT_ADDRESS_BOUND',
      addressBoundRebindingDefence: true,
      runtimeNetworkProbe: 'NOT_RUN',
      userSuppliedUrlFetching: false,
    });
  });

  it('T-24: under CONNECT_PROXY the declaration does NOT claim the address-bound rebinding defence', () => {
    expect(egressDeclaration('CONNECT_PROXY').addressBoundRebindingDefence).toBe(false);
  });

  it('T-23: the declaration is announced at boot', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    new EgressDeclarationReporter().onApplicationBootstrap();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('egressMode=DIRECT_ADDRESS_BOUND'));
    log.mockRestore();
  });

  it('it is registered in the application module, like the landed startup validators', () => {
    expect(readFileSync(join(SRC, 'app.module.ts'), 'utf8')).toMatch(/EgressDeclarationReporter,/);
  });

  it('EG-2: no outbound proxy path exists (TRUST_PROXY, the ingress control, is the positive control)', () => {
    const code = files(SRC).map((f) =>
      readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, ''),
    );
    const proxy =
      /HTTPS_PROXY|HTTP_PROXY|https_proxy|http_proxy|NO_PROXY|ProxyAgent|https-proxy-agent|tunnel-agent/;
    expect(code.filter((c) => proxy.test(c))).toHaveLength(0);
    expect(code.filter((c) => /TRUST_PROXY/.test(c)).length).toBeGreaterThan(0);
  });

  it('EG-4…EG-8 hold in the connector source: A+AAAA, every address classified, dial the IP, governed SNI/Host, verification on', () => {
    const wire = readFileSync(
      join(SRC, 'modules', 'official-data', 'safe-wire-fetch.node.ts'),
      'utf8',
    );
    expect(wire).toMatch(/resolve4/);
    expect(wire).toMatch(/resolve6/);
    expect(wire).toMatch(/classifyResolvedSet/);
    expect(wire).toMatch(/host: req\.address/);
    expect(wire).toMatch(/servername: req\.tlsServerName/);
    expect(wire).toMatch(/rejectUnauthorized: true/);
    expect(wire.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).not.toMatch(
      /dns\.lookup|lookup\(/,
    );
  });
});

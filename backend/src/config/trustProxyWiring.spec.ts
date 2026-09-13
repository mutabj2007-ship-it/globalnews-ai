import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * B-1 - Compose wiring contract for TRUST_PROXY.
 *
 * DELIBERATELY A SEPARATE FILE from dockerComposeWiring.spec.ts. That file is
 * Main's (B3 / R2 / P-2 / P-3) and already contains a coordination test titled
 * "tolerates a future additional backend environment variable without any
 * assertion breaking", written in anticipation of exactly this variable. B-1
 * satisfies that contract rather than editing it, so Main's spec is never
 * opened and the two lanes cannot collide in one file.
 *
 * Structural, readFileSync-based, matching the convention that file established
 * for a non-importable YAML artifact.
 */
describe('B-1 - TRUST_PROXY Compose wiring', () => {
  const repoRoot = join(__dirname, '..', '..', '..');
  const composeSource = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf-8').replace(
    /\r\n/g,
    '\n',
  );
  const envExampleSource = readFileSync(join(repoRoot, '.env.example'), 'utf-8').replace(
    /\r\n/g,
    '\n',
  );

  /** The backend service's environment block, bounded by the next 4-space key. */
  function backendEnvironmentSection(): string {
    const serviceStart = composeSource.indexOf('\n  backend:');
    expect(serviceStart).toBeGreaterThan(-1);

    const nextService = composeSource.indexOf('\n  frontend:');
    const block = composeSource.slice(serviceStart, nextService);

    const envStart = block.indexOf('\n    environment:');
    expect(envStart).toBeGreaterThan(-1);

    const rest = block.slice(envStart + 1);
    const nextKey = rest.search(/\n {4}\S/);
    return nextKey === -1 ? rest : rest.slice(0, nextKey);
  }

  function entryValue(section: string, name: string): string | null {
    const match = section.match(new RegExp(`^\\s+- ${name}=(.*)$`, 'm'));
    return match ? match[1] : null;
  }

  it('reaches the backend container at all - the Compose environment block is the ONLY channel, because .dockerignore excludes .env so ConfigModule finds no env file inside the image', () => {
    expect(entryValue(backendEnvironmentSection(), 'TRUST_PROXY')).not.toBeNull();
  });

  it('defaults to false, so an unset value can never widen trust', () => {
    expect(entryValue(backendEnvironmentSection(), 'TRUST_PROXY')).toBe('${TRUST_PROXY:-false}');
  });

  it('is overridable from the deploying environment rather than hard-coded', () => {
    expect(entryValue(backendEnvironmentSection(), 'TRUST_PROXY')).toContain('${TRUST_PROXY:-');
  });

  it('uses the optional-with-default form, NOT the mandatory ${VAR:?} form - unlike NODE_ENV, an absent value here has a correct and safe meaning', () => {
    expect(entryValue(backendEnvironmentSection(), 'TRUST_PROXY')).not.toContain(':?');
  });

  it('is never placed in any build.args - it is a runtime-only backend value and must not reach an image layer', () => {
    const buildArgsSections = [...composeSource.matchAll(/args:\s*\n((?:\s+\S.*\n)+)/g)];
    for (const section of buildArgsSections) {
      expect(section[1]).not.toContain('TRUST_PROXY');
    }
  });

  it('is not supplied to the frontend service - client-address resolution is a backend concern', () => {
    const frontendStart = composeSource.indexOf('\n  frontend:');
    const volumesStart = composeSource.indexOf('\nvolumes:');
    const frontendBlock = composeSource.slice(frontendStart, volumesStart);
    expect(frontendBlock).not.toContain('TRUST_PROXY');
  });

  describe('regression guards - B-1 must disturb nothing Main committed', () => {
    it('leaves every pre-existing backend runtime variable in place', () => {
      const section = backendEnvironmentSection();
      for (const name of [
        'NODE_ENV',
        'PORT',
        'FRONTEND_ORIGIN',
        'GNEWS_API_KEY',
        'OPENAI_API_KEY',
        'OPENAI_MODEL',
        'ADMIN_PLATFORM_ENABLED',
        'AI_EXECUTION_MODE',
        'OAUTH_CLIENT_ID',
        'OAUTH_CLIENT_SECRET',
        'OAUTH_FLOW_SECRET',
        'DATABASE_URL',
      ]) {
        expect(entryValue(section, name)).not.toBeNull();
      }
    });

    it("preserves Main's P-2 mandatory forms exactly", () => {
      const section = backendEnvironmentSection();
      expect(entryValue(section, 'NODE_ENV')).toContain('${NODE_ENV:?');
      expect(entryValue(section, 'DATABASE_URL')).toContain('${POSTGRES_PASSWORD:?');
      expect(composeSource).not.toContain(':-change_me');
    });

    it("preserves Main's R2 frontend API address contract - SERVER_INTERNAL_API_URL stays runtime-only and out of build.args", () => {
      const frontendStart = composeSource.indexOf('\n  frontend:');
      const volumesStart = composeSource.indexOf('\nvolumes:');
      const frontendBlock = composeSource.slice(frontendStart, volumesStart);

      expect(frontendBlock).toContain('SERVER_INTERNAL_API_URL=${SERVER_INTERNAL_API_URL:-');
      expect(frontendBlock).toContain('NEXT_PUBLIC_API_URL');

      const buildArgs = frontendBlock.slice(
        frontendBlock.indexOf('args:'),
        frontendBlock.indexOf('container_name:'),
      );
      expect(buildArgs).not.toContain('SERVER_INTERNAL_API_URL');
    });

    it('never exposes the Docker-internal backend address through a browser-facing variable', () => {
      const publicValue = composeSource.match(/NEXT_PUBLIC_API_URL[:=]\s*(.*)/g) ?? [];
      for (const line of publicValue) {
        expect(line).not.toContain('backend:');
      }
    });
  });

  describe('.env.example documentation', () => {
    it('documents TRUST_PROXY with the safe default', () => {
      expect(envExampleSource).toMatch(/^TRUST_PROXY=false$/m);
    });

    it('states that the literal "true" is rejected, and why', () => {
      expect(envExampleSource).toMatch(/REJECTED/);
      expect(envExampleSource).toMatch(/fresh rate-limit identity/);
    });

    it('presents the allowlist as the preferred production form and the hop count as conditional', () => {
      expect(envExampleSource).toMatch(/PREFERRED PRODUCTION FORM/);
      expect(envExampleSource).toMatch(/ONLY where ingress topology guarantees/);
    });

    it('states it is never a secret, so no credential is ever placed in it', () => {
      expect(envExampleSource).toMatch(/NOT A SECRET/);
    });

    it("leaves Main's own documented variables intact", () => {
      expect(envExampleSource).toMatch(/^SERVER_INTERNAL_API_URL=/m);
      expect(envExampleSource).toMatch(/^NEXT_PUBLIC_API_URL=/m);
      expect(envExampleSource).toMatch(/^NODE_ENV=/m);
      expect(envExampleSource).toMatch(/^POSTGRES_PASSWORD=/m);
    });
  });
});

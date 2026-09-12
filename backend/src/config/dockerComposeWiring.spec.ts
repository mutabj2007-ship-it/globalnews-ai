import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Milestone B3 — Production Configuration Wiring regression coverage.
 *
 * Structural, readFileSync-based tests (matching the convention
 * already established elsewhere in this codebase — e.g.
 * frontend/src/components/navigation/footerNavHud.spec.ts) against
 * frontend/Dockerfile and docker-compose.yml at the repository root,
 * since neither file is application source code that could otherwise
 * be imported and exercised directly.
 *
 * Guards against exactly the three ways the B3 fix could silently
 * regress:
 *   1. NEXT_PUBLIC_API_URL becoming runtime-only again (the original
 *      bug — a Next.js public env var has no effect if only supplied
 *      after the build already happened).
 *   2. FRONTEND_ORIGIN becoming hard-coded localhost-only again (which
 *      would make a real production deployment impossible to
 *      configure without editing this tracked file).
 *   3. The OAuth environment variables being dropped from backend
 *      Compose wiring (which would make Google sign-in unconditionally
 *      unavailable in Compose-based deployments, even when the
 *      variables are genuinely set in the deploying environment).
 */
describe('Milestone B3 — Docker/Compose production configuration wiring', () => {
  const repoRoot = join(__dirname, '..', '..', '..');
  const dockerfilePath = join(repoRoot, 'frontend', 'Dockerfile');
  const composePath = join(repoRoot, 'docker-compose.yml');

  const dockerfileSource = readFileSync(dockerfilePath, 'utf-8');
  // B3 — line endings normalized in memory only. In JavaScript regexes `\r` is
  // a line terminator, so `.` stops before it and any pattern spanning a line
  // end cannot match on a CRLF checkout. This normalizes ONLY the string these
  // assertions read: no repository file is modified.
  const composeSource = readFileSync(composePath, 'utf-8').replace(/\r\n/g, '\n');

  describe('frontend/Dockerfile', () => {
    it('declares ARG NEXT_PUBLIC_API_URL and ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL', () => {
      expect(dockerfileSource).toMatch(/ARG NEXT_PUBLIC_API_URL/);
      expect(dockerfileSource).toMatch(/ENV NEXT_PUBLIC_API_URL=\$NEXT_PUBLIC_API_URL/);
    });

    it('places the ARG/ENV pair inside the "build" stage, before the frontend build command actually runs \u2014 Docker ARG scoping requires this to be re-declared inside the specific stage that needs it, not only before the first FROM', () => {
      const stageStarts = [...dockerfileSource.matchAll(/^FROM .+ AS (\w+)/gm)].map((match) => ({
        name: match[1],
        index: match.index ?? 0,
      }));
      const buildStageStart = stageStarts.find((s) => s.name === 'build');
      const nextStageAfterBuild = stageStarts.find(
        (s) => (s.index ?? 0) > (buildStageStart?.index ?? 0),
      );
      expect(buildStageStart).toBeDefined();

      const buildStageEnd = nextStageAfterBuild
        ? nextStageAfterBuild.index
        : dockerfileSource.length;
      const buildStageText = dockerfileSource.slice(buildStageStart!.index, buildStageEnd);

      const argIndex = buildStageText.indexOf('ARG NEXT_PUBLIC_API_URL');
      const envIndex = buildStageText.indexOf('ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL');
      const runBuildIndex = buildStageText.indexOf('npm run build --workspace=frontend');

      expect(argIndex).toBeGreaterThan(-1);
      expect(envIndex).toBeGreaterThan(-1);
      expect(runBuildIndex).toBeGreaterThan(-1);
      expect(argIndex).toBeLessThan(runBuildIndex);
      expect(envIndex).toBeLessThan(runBuildIndex);
    });

    it('never places an OAuth secret in a Docker build ARG/ENV instruction \u2014 those are runtime-only backend container values', () => {
      for (const secretVar of ['OAUTH_CLIENT_SECRET', 'OAUTH_FLOW_SECRET', 'OAUTH_CLIENT_ID']) {
        expect(dockerfileSource).not.toMatch(new RegExp(`ARG ${secretVar}`));
        expect(dockerfileSource).not.toMatch(new RegExp(`ENV ${secretVar}`));
      }
    });
  });

  describe('docker-compose.yml', () => {
    it('passes NEXT_PUBLIC_API_URL through the frontend service\u2019s build.args, not only its runtime environment', () => {
      // Simpler, robust check: the args: block for NEXT_PUBLIC_API_URL
      // must appear inside a build: section, immediately preceding the
      // frontend service's own container_name — confirming it is that
      // service's build args, not some unrelated key.
      const buildArgsBlock = composeSource.match(
        /dockerfile: frontend\/Dockerfile[\s\S]*?args:\s*\n\s*NEXT_PUBLIC_API_URL:\s*(\S.*)\n[\s\S]*?container_name: globalnews-ai-frontend/,
      );
      expect(buildArgsBlock).not.toBeNull();
      expect(buildArgsBlock?.[1]).toContain('${NEXT_PUBLIC_API_URL:-');
      // Preserves the same localhost default as before this change.
      expect(buildArgsBlock?.[1]).toContain('http://localhost:${BACKEND_PORT:-4000}');
    });

    it('FRONTEND_ORIGIN is environment-overridable, not an unconditional hard-coded value, while still defaulting to localhost', () => {
      expect(composeSource).toMatch(
        /FRONTEND_ORIGIN=\$\{FRONTEND_ORIGIN:-http:\/\/localhost:\$\{FRONTEND_PORT:-3000\}\}/,
      );
      // The old, unconditional form must no longer be present.
      expect(composeSource).not.toMatch(
        /FRONTEND_ORIGIN=http:\/\/localhost:\$\{FRONTEND_PORT:-3000\}\n/,
      );
    });

    it('passes all three OAuth environment variables into the backend service\u2019s runtime environment', () => {
      for (const oauthVar of ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'OAUTH_FLOW_SECRET']) {
        expect(composeSource).toMatch(new RegExp(`- ${oauthVar}=\\$\\{${oauthVar}:-\\}`));
      }
    });

    it('never places an OAuth variable inside any service\u2019s build.args \u2014 these are runtime environment values only', () => {
      const buildArgsSections = [...composeSource.matchAll(/args:\s*\n((?:\s+\S.*\n)+)/g)];
      for (const section of buildArgsSections) {
        for (const oauthVar of ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'OAUTH_FLOW_SECRET']) {
          expect(section[1]).not.toContain(oauthVar);
        }
      }
    });

    it('is still valid, parseable YAML after all B3 changes', () => {
      // A lightweight structural sanity check without a YAML library
      // dependency: every top-level service key still present, no
      // obviously broken indentation introduced (tabs, which YAML
      // forbids).
      expect(composeSource).toMatch(/^services:/m);
      expect(composeSource).toMatch(/^\s{2}postgres:/m);
      expect(composeSource).toMatch(/^\s{2}backend:/m);
      expect(composeSource).toMatch(/^\s{2}frontend:/m);
      expect(composeSource).toMatch(/^volumes:/m);
      expect(composeSource).not.toMatch(/\t/);
    });
  });
});

/**
 * Milestone R2 - frontend server-side backend address wiring.
 *
 * Appended alongside the B3 block above (which it deliberately leaves
 * untouched). B3 proved the BROWSER contract: NEXT_PUBLIC_API_URL must
 * reach the frontend BUILD, because Next.js inlines public env vars into
 * the client bundle. R2 covers the complementary SERVER contract: code
 * that executes inside the frontend container cannot reach the backend
 * at `localhost`, so it needs a runtime-only, non-public variable
 * carrying the Docker-internal service address - and that variable must
 * never travel through build.args, or it would be inlined into the
 * browser bundle it must never appear in.
 */
describe('Milestone R2 - frontend server-side backend address wiring', () => {
  const repoRoot = join(__dirname, '..', '..', '..');
  const composePath = join(repoRoot, 'docker-compose.yml');
  // Same in-memory-only CRLF normalization as the B3 block above: in
  // JavaScript regexes `\r` is a line terminator, so `.` stops before it.
  // No repository file is modified.
  const composeSource = readFileSync(composePath, 'utf-8').replace(/\r\n/g, '\n');

  // Anchored on newline + exact indentation so these slices can never be
  // satisfied by the words "build:" or "environment:" appearing inside a
  // YAML comment, nor by another service's wiring.
  const frontendServiceStart = composeSource.indexOf('\n  frontend:');
  const nextTopLevelKey = composeSource.indexOf('\nvolumes:', frontendServiceStart);
  const frontendService = composeSource.slice(
    frontendServiceStart,
    nextTopLevelKey === -1 ? composeSource.length : nextTopLevelKey,
  );
  const buildSection = frontendService.slice(
    frontendService.indexOf('\n    build:'),
    frontendService.indexOf('\n    container_name:'),
  );
  const runtimeEnvironmentSection = frontendService.slice(
    frontendService.indexOf('\n    environment:'),
  );

  it('resolves the frontend service, its build section and its runtime environment section', () => {
    expect(frontendServiceStart).toBeGreaterThan(-1);
    expect(buildSection).toContain('dockerfile: frontend/Dockerfile');
    expect(runtimeEnvironmentSection).toContain('- NODE_ENV=');
    expect(runtimeEnvironmentSection).not.toContain('dockerfile: frontend/Dockerfile');
  });

  it('supplies SERVER_INTERNAL_API_URL to the frontend service runtime environment', () => {
    expect(runtimeEnvironmentSection).toMatch(/^\s+- SERVER_INTERNAL_API_URL=/m);
  });

  it('defaults SERVER_INTERNAL_API_URL to the Docker-internal backend service address, still overridable from the deploying environment', () => {
    const match = runtimeEnvironmentSection.match(/- SERVER_INTERNAL_API_URL=(.*)/);
    expect(match).not.toBeNull();
    const value = match?.[1] ?? '';
    expect(value).toContain('${SERVER_INTERNAL_API_URL:-');
    expect(value).toContain('http://backend:${BACKEND_PORT:-4000}');
    // Must not default to the browser-facing address: inside the frontend
    // container `localhost` is the frontend itself, which is precisely the
    // defect R2 exists to fix.
    expect(value).not.toContain('localhost');
  });

  it('never passes SERVER_INTERNAL_API_URL through the frontend build.args - it is runtime-only and must never be inlined into the browser bundle', () => {
    expect(buildSection).toContain('args:');
    expect(buildSection).not.toContain('SERVER_INTERNAL_API_URL');
  });

  it('leaves the existing B3 NEXT_PUBLIC_API_URL build-time contract unchanged', () => {
    expect(buildSection).toMatch(
      /args:\s*\n\s*NEXT_PUBLIC_API_URL:\s*\$\{NEXT_PUBLIC_API_URL:-http:\/\/localhost:\$\{BACKEND_PORT:-4000\}\}/,
    );
    expect(runtimeEnvironmentSection).toMatch(
      /- NEXT_PUBLIC_API_URL=http:\/\/localhost:\$\{BACKEND_PORT:-4000\}/,
    );
  });
});

/**
 * P-2 / P-3 - deployment envelope configuration contract.
 *
 * Appended alongside the B3 and R2 blocks above, both of which it leaves
 * untouched.
 *
 * B-4 of the MVP launch audit: docker-compose.yml supplied
 * `${NODE_ENV:-development}` for both services, which silently overrode each
 * image's own `ENV NODE_ENV=production` and disarmed every fail-closed guard in
 * the codebase at once - CorsStartupValidator, NewsStartupValidator,
 * AnalysisStartupValidator, and the `Secure` attribute on all three auth
 * cookies. `${POSTGRES_PASSWORD:-change_me}` had the same shape: a placeholder
 * credential one missing variable away from a real deployment. Both are now
 * mandatory (`${VAR:?message}`), so Compose refuses to render rather than guess.
 *
 * Separately, `.dockerignore` excludes `.env`, so ConfigModule's `envFilePath`
 * finds no file inside a built image and this `environment:` block is the ONLY
 * source of backend configuration. Two documented, ConfigService-read variables
 * could therefore never reach the container at all; ADMIN_PLATFORM_ENABLED in
 * particular made the entire /admin surface unreachable in any Compose
 * deployment regardless of what the deploying environment set.
 *
 * ADDITIVITY (B-1 coordination): every assertion below is a containment check
 * over a bounded service slice. None asserts an exhaustive variable list, an
 * ordering, or a count - so a later lane appending its own bounded deployment
 * variable to the backend environment cannot break this suite. That property is
 * itself proved by the final test rather than merely asserted in this comment.
 */
describe('P-2 / P-3 - deployment envelope configuration contract', () => {
  const repoRoot = join(__dirname, '..', '..', '..');
  const composePath = join(repoRoot, 'docker-compose.yml');
  // In-memory-only CRLF normalization, as in the blocks above. No repository
  // file is modified.
  const composeSource = readFileSync(composePath, 'utf-8').replace(/\r\n/g, '\n');

  /**
   * Slices one service's block out of the compose file, anchored on newline plus
   * exact two-space indentation so the words "backend:" or "frontend:" appearing
   * inside a YAML comment, a hostname or another service's wiring can never
   * satisfy it.
   */
  function serviceBlock(name: string): string {
    const start = composeSource.indexOf(`\n  ${name}:`);
    expect(start).toBeGreaterThan(-1);
    const rest = composeSource.slice(start + 1);
    const nextKey = rest.search(/\n(?: {2}\S|\S)/);
    return nextKey === -1 ? rest : rest.slice(0, nextKey);
  }

  /** The `environment:` list of one service, excluding its build section. */
  function environmentSection(name: string): string {
    const block = serviceBlock(name);
    const start = block.indexOf('\n    environment:');
    expect(start).toBeGreaterThan(-1);
    const rest = block.slice(start + 1);
    const nextKey = rest.search(/\n {4}\S/);
    return nextKey === -1 ? rest : rest.slice(0, nextKey);
  }

  /** The single `- NAME=value` entry for one variable, value only. */
  function entryValue(section: string, name: string): string | null {
    const match = section.match(new RegExp(`^\\s+- ${name}=(.*)$`, 'm'));
    return match ? match[1] : null;
  }

  describe('P-2 - no silent unsafe defaults', () => {
    it.each(['backend', 'frontend'])(
      'the %s service requires NODE_ENV explicitly and supplies no default',
      (service) => {
        const value = entryValue(environmentSection(service), 'NODE_ENV');
        expect(value).not.toBeNull();
        // Mandatory form: Compose errors out instead of substituting.
        expect(value).toContain('${NODE_ENV:?');
        // The disarming default must be gone, in every form.
        expect(value).not.toContain('${NODE_ENV:-');
        expect(value).not.toContain('${NODE_ENV}');
      },
    );

    it('the error message says what to set, not merely that something is missing', () => {
      const value = entryValue(environmentSection('backend'), 'NODE_ENV') ?? '';
      expect(value).toMatch(/development/);
      expect(value).toMatch(/production/);
    });

    it('the postgres service requires POSTGRES_PASSWORD explicitly and supplies no default', () => {
      const value = entryValue(environmentSection('postgres'), 'POSTGRES_PASSWORD');
      expect(value).not.toBeNull();
      expect(value).toContain('${POSTGRES_PASSWORD:?');
      expect(value).not.toContain('${POSTGRES_PASSWORD:-');
    });

    it('the backend DATABASE_URL uses the same mandatory password form, so the two can never drift apart', () => {
      const value = entryValue(environmentSection('backend'), 'DATABASE_URL') ?? '';
      expect(value).toContain('${POSTGRES_PASSWORD:?');
      expect(value).not.toContain('${POSTGRES_PASSWORD:-');
      // Still the Compose service hostname, not localhost - unchanged from #54.
      expect(value).toContain('@postgres:5432');
    });

    it('no placeholder credential default survives anywhere in the file', () => {
      expect(composeSource).not.toContain(':-change_me');
    });
  });

  describe('P-3 - backend environment pass-through', () => {
    it('passes ADMIN_PLATFORM_ENABLED through, defaulting to the fail-closed value the guard already assumes', () => {
      const value = entryValue(environmentSection('backend'), 'ADMIN_PLATFORM_ENABLED');
      expect(value).toBe('${ADMIN_PLATFORM_ENABLED:-false}');
    });

    it('passes AI_EXECUTION_MODE through, defaulting to the mock-permitted value the config service already assumes', () => {
      const value = entryValue(environmentSection('backend'), 'AI_EXECUTION_MODE');
      expect(value).toBe('${AI_EXECUTION_MODE:-development}');
    });

    it('keeps both out of any build.args - they are runtime-only backend values', () => {
      for (const service of ['backend', 'frontend']) {
        const block = serviceBlock(service);
        const envStart = block.indexOf('\n    environment:');
        const beforeEnvironment = envStart === -1 ? block : block.slice(0, envStart);
        expect(beforeEnvironment).not.toContain('ADMIN_PLATFORM_ENABLED');
        expect(beforeEnvironment).not.toContain('AI_EXECUTION_MODE');
      }
    });
  });

  describe('regression guards for wiring this change must not disturb', () => {
    it('leaves every pre-existing backend runtime variable in place', () => {
      const section = environmentSection('backend');
      for (const name of [
        'PORT',
        'FRONTEND_ORIGIN',
        'GNEWS_API_KEY',
        'OPENAI_API_KEY',
        'OPENAI_MODEL',
        'OAUTH_CLIENT_ID',
        'OAUTH_CLIENT_SECRET',
        'OAUTH_FLOW_SECRET',
        'DATABASE_URL',
      ]) {
        expect(entryValue(section, name)).not.toBeNull();
      }
    });

    it('does not introduce unrelated provider configuration into Compose in this change', () => {
      const section = environmentSection('backend');
      for (const name of ['GDELT_ENABLED', 'EVENT_REGISTRY_ENABLED', 'EVENT_REGISTRY_API_KEY']) {
        expect(entryValue(section, name)).toBeNull();
      }
    });

    it('never places a secret-bearing variable in any build.args', () => {
      const buildArgsSections = [...composeSource.matchAll(/args:\n((?:\s+\S.*\n)+?)\s{4}\S/g)];
      for (const section of buildArgsSections) {
        for (const secretVar of [
          'OAUTH_CLIENT_SECRET',
          'OAUTH_FLOW_SECRET',
          'POSTGRES_PASSWORD',
          'GNEWS_API_KEY',
          'OPENAI_API_KEY',
        ]) {
          expect(section[1]).not.toContain(secretVar);
        }
      }
    });
  });

  /**
   * B-1 coordination proof. A later lane is expected to add its own bounded
   * deployment variable (a proxy-hops setting) to the backend environment. This
   * test proves the assertions above are containment checks that tolerate that
   * addition, rather than exhaustive-list or ordering checks that would fail on
   * it. The augmented source exists only as a string inside this test - no
   * repository file is read differently, written, or modified, and no claim is
   * made about any variable that does not yet exist.
   */
  it('tolerates a future additional backend environment variable without any assertion breaking', () => {
    const section = environmentSection('backend');
    const augmented = section.replace(
      '\n      - PORT=4000',
      '\n      - __FUTURE_DEPLOYMENT_VARIABLE__=${__FUTURE_DEPLOYMENT_VARIABLE__:-1}\n      - PORT=4000',
    );
    expect(augmented).not.toBe(section);

    // Every P-2/P-3 assertion re-evaluated against the augmented section.
    expect(entryValue(augmented, 'NODE_ENV')).toContain('${NODE_ENV:?');
    expect(entryValue(augmented, 'ADMIN_PLATFORM_ENABLED')).toBe(
      '${ADMIN_PLATFORM_ENABLED:-false}',
    );
    expect(entryValue(augmented, 'AI_EXECUTION_MODE')).toBe('${AI_EXECUTION_MODE:-development}');
    expect(entryValue(augmented, 'DATABASE_URL')).toContain('${POSTGRES_PASSWORD:?');
    expect(entryValue(augmented, 'PORT')).toBe('4000');
    expect(entryValue(augmented, '__FUTURE_DEPLOYMENT_VARIABLE__')).not.toBeNull();
  });
});

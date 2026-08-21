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
      const nextStageAfterBuild = stageStarts.find((s) => (s.index ?? 0) > (buildStageStart?.index ?? 0));
      expect(buildStageStart).toBeDefined();

      const buildStageEnd = nextStageAfterBuild ? nextStageAfterBuild.index : dockerfileSource.length;
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
      expect(composeSource).not.toMatch(/FRONTEND_ORIGIN=http:\/\/localhost:\$\{FRONTEND_PORT:-3000\}\n/);
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

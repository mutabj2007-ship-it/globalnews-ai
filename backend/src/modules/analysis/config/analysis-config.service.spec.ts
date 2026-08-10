import { ConfigService } from '@nestjs/config';
import { AnalysisConfigService } from './analysis-config.service';

function makeService(
  values: Record<string, string | undefined>,
): AnalysisConfigService {
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  return new AnalysisConfigService(config);
}

describe('AnalysisConfigService', () => {
  describe('executionMode', () => {
    it('forces production mode when NODE_ENV is production and AI_EXECUTION_MODE is absent', () => {
      const service = makeService({
        NODE_ENV: 'production',
        AI_EXECUTION_MODE: undefined,
      });

      expect(service.get().executionMode).toBe('production');
    });

    it('forces production mode when NODE_ENV is production even if AI_EXECUTION_MODE says development', () => {
      const service = makeService({
        NODE_ENV: 'production',
        AI_EXECUTION_MODE: 'development',
      });

      expect(service.get().executionMode).toBe('production');
    });

    it('allows explicit production mode outside NODE_ENV production', () => {
      const service = makeService({
        NODE_ENV: 'development',
        AI_EXECUTION_MODE: 'production',
      });

      expect(service.get().executionMode).toBe('production');
    });

    it('defaults to development mode outside production when AI_EXECUTION_MODE is absent', () => {
      const service = makeService({
        NODE_ENV: 'development',
        AI_EXECUTION_MODE: undefined,
      });

      expect(service.get().executionMode).toBe('development');
    });

    it('defaults to development for an unrecognized execution mode outside production', () => {
      const service = makeService({
        NODE_ENV: 'development',
        AI_EXECUTION_MODE: 'invalid-value',
      });

      expect(service.get().executionMode).toBe('development');
    });
  });
});

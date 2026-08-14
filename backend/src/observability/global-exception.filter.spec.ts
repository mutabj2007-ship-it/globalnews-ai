import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { runWithRequestId } from './request-context';

/**
 * Milestone #55 — proves the exact acceptance requirement: known
 * HttpExceptions keep their real status code and response body
 * byte-for-byte unchanged; only a genuinely unexpected error is
 * converted to a sanitized generic 500, and even then the response
 * never contains the caught error's own message, stack, or any
 * credential/connection detail.
 */
describe('GlobalExceptionFilter (Milestone #55)', () => {
  function makeFakeHost(response: { status: jest.Mock; json: jest.Mock }) {
    return {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as never;
  }

  function makeFakeResponse() {
    const response = {
      status: jest.fn(),
      json: jest.fn(),
    };
    response.status.mockReturnValue(response);
    return response;
  }

  it('preserves a NotFoundException\u2019s real 404 status and response body unchanged', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();
    const exception = new NotFoundException('Article not found');

    filter.catch(exception, makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('preserves a BadRequestException\u2019s real 400 status and validation body unchanged', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();
    const exception = new BadRequestException(['query must not be empty']);

    filter.catch(exception, makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('preserves HealthController\u2019s ServiceUnavailableException 503 and structured body unchanged', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();
    const exception = new ServiceUnavailableException({
      status: 'unavailable',
      timestamp: '2026-01-01T00:00:00.000Z',
      database: 'unavailable',
    });

    filter.catch(exception, makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('any HttpException subclass takes the same preserve-unchanged branch, not just the ones explicitly tested above', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();
    const exception = new HttpException('Too Many Requests', 429);

    filter.catch(exception, makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('converts a genuinely unexpected error to a sanitized generic 500', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();
    const exception = new Error('unexpected internal failure');

    filter.catch(exception, makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0];
    expect(body.status).toBe('error');
    expect(body.message).toBe('An unexpected error occurred.');
  });

  it('the sanitized 500 response never contains the caught error\u2019s own message, stack, or any credential/connection detail', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();
    const sensitiveError = new Error(
      'connection failed: postgresql://globalnews_ai_user:REAL_SECRET@prod-db-host:5432/globalnews_ai',
    );

    filter.catch(sensitiveError, makeFakeHost(response));

    const bodyText = JSON.stringify(response.json.mock.calls[0][0]);
    expect(bodyText).not.toContain('REAL_SECRET');
    expect(bodyText).not.toContain('prod-db-host');
    expect(bodyText).not.toContain('connection failed');
    expect(bodyText).not.toContain(sensitiveError.stack ?? '\u0000unused\u0000');
  });

  it('includes the active request ID in the sanitized 500 body for support correlation, without leaking anything else', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();
    const exception = new Error('boom');

    runWithRequestId('req-correlate-500', () => {
      filter.catch(exception, makeFakeHost(response));
    });

    const body = response.json.mock.calls[0][0];
    expect(body.requestId).toBe('req-correlate-500');
  });
});

import {
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
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

/**
 * S1.1 — PAYLOAD TOO LARGE NORMALIZATION.
 *
 * S1 set an explicit 64kb request body limit in main.ts. body-parser enforces
 * it by throwing an `http-errors` error, which is NOT a Nest HttpException —
 * so it fell into this filter's generic branch and reached the client as
 * "An unexpected error occurred." with a 500, logged at ERROR level as an
 * unhandled exception.
 *
 * That was safe (the body was already a fixed, hardcoded shape) but wrong in
 * two ways worth separating: a client could not distinguish its own mistake
 * from a server fault, and anyone could generate unlimited ERROR-level log
 * entries for free, which is how a genuine failure gets buried.
 *
 * These tests pin the repair AND pin what the repair must not disturb.
 */
describe('GlobalExceptionFilter — S1.1 payload-too-large normalization', () => {
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

  /**
   * The real shape body-parser throws, reproduced field for field: an Error
   * carrying `type`, `status`, `statusCode`, `expected`, `length` and `limit`.
   * Built here rather than imported so this suite does not depend on
   * body-parser's internals staying importable.
   */
  function makeBodyParserPayloadTooLargeError(): Error {
    const error = new Error('request entity too large');
    error.name = 'PayloadTooLargeError';

    return Object.assign(error, {
      type: 'entity.too.large',
      status: 413,
      statusCode: 413,
      expected: 204800,
      length: 204800,
      limit: 65536,
    });
  }

  it('converts a body-parser PayloadTooLargeError to a real 413', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    filter.catch(makeBodyParserPayloadTooLargeError(), makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.status).not.toHaveBeenCalledWith(500);
  });

  it('answers with a bounded, sanitized body — no parser internals, no raw message, no stack', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();
    const exception = makeBodyParserPayloadTooLargeError();

    filter.catch(exception, makeFakeHost(response));

    const body = response.json.mock.calls[0][0];
    const bodyText = JSON.stringify(body);

    // Exactly the three keys the sanitized 500 uses, and nothing else.
    expect(Object.keys(body).sort()).toEqual(['message', 'requestId', 'status'].sort());
    expect(body.status).toBe('error');
    expect(body.message).toBe('Request payload is too large.');

    // The parser's own wording never reaches the client.
    expect(bodyText).not.toContain('request entity too large');
    expect(bodyText).not.toContain('PayloadTooLargeError');
    expect(bodyText).not.toContain('entity.too.large');

    // Neither do its internals: the configured limit and the received length
    // are both facts about our configuration, and neither is disclosed.
    expect(bodyText).not.toContain('65536');
    expect(bodyText).not.toContain('204800');

    // And no stack, ever.
    expect(bodyText).not.toContain(exception.stack ?? '\u0000unused\u0000');
    expect(bodyText).not.toContain('at Object');
  });

  it('never echoes any part of the oversized request body back to the caller', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    // A payload error whose message has been polluted with caller-controlled
    // content — the shape a reflection bug would take.
    const exception = Object.assign(
      new Error('request entity too large: {"secret":"CALLER_SUPPLIED_MARKER"}'),
      { type: 'entity.too.large', status: 413, statusCode: 413 },
    );

    filter.catch(exception, makeFakeHost(response));

    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain('CALLER_SUPPLIED_MARKER');
  });

  it('logs the 413 at WARN, never as a generic ERROR-level unhandled exception', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      filter.catch(makeBodyParserPayloadTooLargeError(), makeFakeHost(response));

      expect(error).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);

      const line = String(warn.mock.calls[0][0]);
      expect(line).toContain('413');
      // The log line is as sanitized as the response: the parser's message and
      // its numbers stay out of the operator's stream too.
      expect(line).not.toContain('request entity too large');
      expect(line).not.toContain('65536');
      expect(line).not.toContain('Unhandled exception');
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it('includes the active request ID on the 413, for the same correlation reason the 500 does', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    runWithRequestId('req-correlate-413', () => {
      filter.catch(makeBodyParserPayloadTooLargeError(), makeFakeHost(response));
    });

    expect(response.json.mock.calls[0][0].requestId).toBe('req-correlate-413');
  });

  it('recognises the error by status alone, without the body-parser type marker', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    // Any http-errors-style 413 from equivalent middleware, with no `type`.
    filter.catch(Object.assign(new Error('too big'), { status: 413 }), makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(413);
  });

  it('recognises statusCode as well as status, since http-errors sets both', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    filter.catch(Object.assign(new Error('too big'), { statusCode: 413 }), makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(413);
  });

  it('does NOT match on message text, so a reworded dependency cannot silently change behaviour', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    // Says the right words, carries no status at all: still a 500.
    filter.catch(new Error('request entity too large'), makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.status).not.toHaveBeenCalledWith(413);
  });

  it('is deliberately narrow: another http-errors status is NOT normalized here', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    filter.catch(Object.assign(new Error('nope'), { status: 418 }), makeFakeHost(response));

    // Unchanged generic branch — widening this branch would rewrite responses
    // for error shapes nobody has reviewed.
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('ignores non-object throwables rather than crashing on them', () => {
    const filter = new GlobalExceptionFilter();

    for (const thrown of [null, undefined, 'a string', 413]) {
      const response = makeFakeResponse();
      filter.catch(thrown, makeFakeHost(response));
      expect(response.status).toHaveBeenCalledWith(500);
    }
  });
});

describe('GlobalExceptionFilter — S1.1 leaves existing behaviour untouched', () => {
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

  it("a deliberately thrown Nest PayloadTooLargeException still keeps ITS OWN body, not the filter's", () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();
    const exception = new PayloadTooLargeException('Upload exceeds the per-file cap.');

    filter.catch(exception, makeFakeHost(response));

    // The HttpException branch runs first, by design: application code that
    // chooses to throw a 413 with its own wording keeps that wording.
    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json).toHaveBeenCalledWith(exception.getResponse());
    expect(response.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Request payload is too large.' }),
    );
  });

  it('an ordinary unknown exception is still the sanitized 500, unchanged', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    filter.catch(new Error('unexpected internal failure'), makeFakeHost(response));

    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0];
    expect(body.status).toBe('error');
    expect(body.message).toBe('An unexpected error occurred.');
  });

  it('an unknown exception is still logged at ERROR, so real faults keep their severity', () => {
    const filter = new GlobalExceptionFilter();
    const response = makeFakeResponse();

    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      filter.catch(new Error('boom'), makeFakeHost(response));

      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][0])).toContain('Unhandled exception');
    } finally {
      error.mockRestore();
    }
  });

  it('a 404 and a 400 still pass through with their real status and body', () => {
    const filter = new GlobalExceptionFilter();

    const notFound = makeFakeResponse();
    const notFoundException = new NotFoundException('Article not found');
    filter.catch(notFoundException, makeFakeHost(notFound));
    expect(notFound.status).toHaveBeenCalledWith(404);
    expect(notFound.json).toHaveBeenCalledWith(notFoundException.getResponse());

    const badRequest = makeFakeResponse();
    const badRequestException = new BadRequestException(['query must not be empty']);
    filter.catch(badRequestException, makeFakeHost(badRequest));
    expect(badRequest.status).toHaveBeenCalledWith(400);
    expect(badRequest.json).toHaveBeenCalledWith(badRequestException.getResponse());
  });
});

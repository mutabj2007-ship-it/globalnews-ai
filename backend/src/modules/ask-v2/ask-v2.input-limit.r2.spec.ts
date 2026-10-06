import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { ASK_QUESTION_MAX_CHARS, ASK_QUESTION_TOO_LONG } from '@globalnews-ai/shared';
import type { PrismaService } from '../../database/prisma.service';
import { AskQuestionTooLong, AskV2Service } from './ask-v2.service';
import { ASK_QUESTION_TRANSPORT_MAX, QuoteTurnDto } from './ask-v2.dto';
import type { AskExecutionPort } from './ask-compute.contract';
import { accountPrincipal } from './guest/ask-principal';

/**
 * ASK RETRIEVAL / CONVERSATION R2 — the one documented input limit, server side (gate A / G).
 *
 * The DTO used to stop at 1,000 characters with an UNTYPED 400 the composer could only show as
 * "Ask is unavailable". The documented limit is now ASK_QUESTION_MAX_CHARS (shared), refused by
 * name BEFORE any database read, slot, meter, guest allowance or planner: a refused question
 * consumes nothing. The DTO keeps only a transport backstop far above it.
 */
const untouchable = new Proxy(
  {},
  {
    get(_t, key) {
      throw new Error(`the database was touched (${String(key)}) for a refused question`);
    },
  },
) as unknown as PrismaService;
const adapter: AskExecutionPort = {
  prepare: () => {
    throw new Error('the planner ran for a refused question');
  },
  execute: () => {
    throw new Error('execution ran for a refused question');
  },
} as never;
const service = new AskV2Service(untouchable, new ConfigService({}), adapter);
const owner = accountPrincipal('00000000-0000-4000-8000-000000000001');
const dto = (question: string): QuoteTurnDto =>
  ({ idempotencyKey: 'k-1', question, language: 'en', intent: 'ask' }) as QuoteTurnDto;

describe('ASK R2 · the documented question limit (server)', () => {
  it('one character over the limit is refused BY NAME, before anything is read or reserved', async () => {
    const over = 'a'.repeat(ASK_QUESTION_MAX_CHARS + 1);
    await expect(service.quote(owner, 't-1', dto(over))).rejects.toBeInstanceOf(AskQuestionTooLong);
    await expect(service.submit(owner, 't-1', dto(over))).rejects.toBeInstanceOf(AskQuestionTooLong);
  });

  it('the refusal body carries the typed code the composer maps (and the limit)', () => {
    const body = new AskQuestionTooLong().getResponse();
    expect(body).toEqual({ statusCode: 400, code: ASK_QUESTION_TOO_LONG, maxChars: ASK_QUESTION_MAX_CHARS });
    expect(ASK_QUESTION_TOO_LONG).toMatch(/^[A-Z_]{3,60}$/); /* the client keeps only codes of this form */
  });

  it('surrounding whitespace does not count; emoji count once (code points)', async () => {
    const atLimit = `  ${'😀'.repeat(ASK_QUESTION_MAX_CHARS)}  `;
    /* within the limit → it proceeds past the check and reaches the (untouchable) database */
    await expect(service.quote(owner, 't-1', dto(atLimit))).rejects.toThrow(/database was touched|planner ran/);
  });

  it('the DTO accepts the documented limit and keeps only a transport backstop above it', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const meta = { type: 'body' as const, metatype: QuoteTurnDto };
    const ok = { idempotencyKey: 'k', question: 'q'.repeat(ASK_QUESTION_MAX_CHARS), language: 'en', intent: 'ask' };
    await expect(pipe.transform(ok, meta)).resolves.toBeInstanceOf(QuoteTurnDto);
    expect(ASK_QUESTION_TRANSPORT_MAX).toBeGreaterThan(ASK_QUESTION_MAX_CHARS);
    await expect(
      pipe.transform({ ...ok, question: 'q'.repeat(ASK_QUESTION_TRANSPORT_MAX + 1) }, meta),
    ).rejects.toThrow();
  });
});

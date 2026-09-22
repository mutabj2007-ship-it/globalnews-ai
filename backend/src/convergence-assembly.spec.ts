import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
import {
  ASK_EXECUTION_PORT,
  UNWIRED_ASK_EXECUTION_PORT,
} from './modules/ask-v2/ask-compute.contract';

it('combined AppModule assembles while new public evidence and execution stay on HOLD', async () => {
  const transport = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('No external transport'));
  const oldAsk = process.env.ASK_V2_ENABLED;
  delete process.env.ASK_V2_ENABLED;
  let app: INestApplication | undefined;
  const forbiddenDatabase = jest.fn(() => {
    throw new Error('Database access forbidden');
  });
  const delegates = Object.fromEntries(
    [
      'situation',
      'situationSnapshot',
      'situationCluster',
      'situationClusterMember',
      'situationShadowDecision',
    ].map((name) => [
      name,
      Object.fromEntries(
        ['findUnique', 'findMany', 'findFirst', 'create', 'createMany', 'update'].map((method) => [
          method,
          forbiddenDatabase,
        ]),
      ),
    ]),
  );
  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $transaction: forbiddenDatabase, ...delegates })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    expect(moduleRef.get(ASK_EXECUTION_PORT)).toBe(UNWIRED_ASK_EXECUTION_PORT);
    const security = await request(app.getHttpServer())
      .get('/security/observations/PL')
      .expect(200);
    expect(security.body.observations).toEqual([]);
    expect(security.body.absence).toBe('NOT_ASSESSED');
    const politics = await request(app.getHttpServer()).get('/politics/observations').expect(200);
    expect(politics.body.observations).toEqual([]);
    expect(politics.body.acquisition).toBe('RETAINED_ONLY');
    await request(app.getHttpServer()).get('/ask-v2/threads').expect(404);
    await request(app.getHttpServer()).get('/watch').expect(404);
    expect(transport).not.toHaveBeenCalled();
    expect(forbiddenDatabase).not.toHaveBeenCalled();
  } finally {
    if (app) await app.close();
    if (oldAsk === undefined) delete process.env.ASK_V2_ENABLED;
    else process.env.ASK_V2_ENABLED = oldAsk;
    transport.mockRestore();
  }
});

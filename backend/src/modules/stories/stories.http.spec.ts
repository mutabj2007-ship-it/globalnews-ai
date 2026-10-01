import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request = require('supertest');
import { SessionService } from '../auth/session.service';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AdminPlatformEnabledGuard } from '../admin/admin-platform.guard';
import { AdminGuard } from '../admin/admin.guard';
import { AdminService } from '../admin/admin.service';
import { computeArticleRef } from '../news/identity/article-ref.util';
import { DiscussionController } from './discussion.controller';
import { AlertsController } from './alerts.controller';
import { AdminStoriesController } from './admin-stories.controller';
import { DiscussionService } from './discussion.service';
import { AlertsService } from './alerts.service';
import { StoryIdentityService } from './story-identity.service';
import { AlertsInAppGate, DiscussionReadGate, DiscussionWriteGate } from './story-gate.guards';

/**
 * STAGE B — the HTTP authorization contract with the REAL guard stack (gate → session →
 * CSRF → admin role/capability). Services are recording fakes: this file proves WHO may
 * reach WHAT, and that a disabled capability does not exist.
 */

const URL_A = 'https://wire.example/stage-b-http-a';
const REF_A = computeArticleRef(URL_A);
const COMMENT = '6f1c1d1e-5a0b-4f7a-9d55-2f7b4d0e9a11';
const STORY = '0b9d5a9e-6a2c-4a7b-9c1e-1d2e3f4a5b6c';
const OTHER = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

describe('Stage B routes — gates, authentication, CSRF, moderation authorization', () => {
  let env: Record<string, string>;
  let roles: Record<string, string | null>;
  const discussion = {
    thread: jest.fn(async (ref: string, viewer: string | null) => ({ articleRef: ref, viewer, comments: [], count: 0 })),
    counts: jest.fn(async () => ({})),
    post: jest.fn(async (userId: string) => ({ id: COMMENT, userId })),
    edit: jest.fn(async () => ({})),
    remove: jest.fn(async () => undefined),
    report: jest.fn(async () => undefined),
    moderate: jest.fn(async () => ({ state: 'HIDDEN' })),
    setLock: jest.fn(async () => ({ locked: true })),
    reportQueue: jest.fn(async () => []),
  };
  const alerts = {
    list: jest.fn(async () => []),
    create: jest.fn(async (userId: string) => ({ id: 'a', userId })),
    byArticle: jest.fn(async () => ({})),
    inbox: jest.fn(async (_u: string, replies: boolean) => ({ replies })),
    markAllRead: jest.fn(async () => undefined),
    markRead: jest.fn(async () => undefined),
    apply: jest.fn(async () => ({})),
  };
  const identity = {
    resolveByArticleRef: jest.fn(async () => null),
    merge: jest.fn(async () => ({})),
    split: jest.fn(async () => ({})),
    backfill: jest.fn(async () => ({})),
  };
  let app: import('@nestjs/common').INestApplication;

  const http = () => request(app.getHttpServer());
  const asReader = (r: request.Test, user = 'reader-1') => r.set('Cookie', [`gna_session=${user}`, 'gna_csrf=tok']).set('X-CSRF-Token', 'tok');
  const noCsrf = (r: request.Test, user = 'reader-1') => r.set('Cookie', [`gna_session=${user}`]);

  beforeAll(async () => {
    const config = { get: (key: string) => env[key] };
    const moduleRef = await Test.createTestingModule({
      controllers: [DiscussionController, AlertsController, AdminStoriesController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: SessionService, useValue: { validateSession: async (raw: string) => (raw ? { userId: raw } : null) } },
        { provide: AdminService, useValue: { findAdminRole: async (id: string) => roles[id] ?? null } },
        { provide: DiscussionService, useValue: discussion },
        { provide: AlertsService, useValue: alerts },
        { provide: StoryIdentityService, useValue: identity },
        Reflector,
        RequireAuthGuard,
        CsrfGuard,
        AdminGuard,
        AdminPlatformEnabledGuard,
        DiscussionReadGate,
        DiscussionWriteGate,
        AlertsInAppGate,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    env = {};
    roles = { 'admin-1': 'ADMIN', 'super-1': 'SUPER_ADMIN', 'support-1': 'SUPPORT', 'analyst-1': 'ANALYST' };
    jest.clearAllMocks();
  });

  const post = { articleRef: REF_A, url: URL_A, body: 'A considered reply.', idempotencyKey: 'draft-0001' };

  describe('gate OFF (the default) — the capability does not exist', () => {
    it('every reader route answers 404, signed in or not, before auth is consulted', async () => {
      await http().get(`/discussion/articles/${REF_A}`).expect(404);
      await http().post('/discussion/counts').send({ articleRefs: [REF_A] }).expect(404);
      await http().post('/discussion/comments').send(post).expect(404);
      await asReader(http().post('/discussion/comments')).send(post).expect(404);
      await asReader(http().post(`/discussion/comments/${COMMENT}/edit`)).send({ body: 'x' }).expect(404);
      await asReader(http().delete(`/discussion/comments/${COMMENT}`)).expect(404);
      await http().get('/alerts').expect(404);
      await asReader(http().get('/alerts')).expect(404);
      await asReader(http().post('/alerts')).send({ articleRef: REF_A, url: URL_A }).expect(404);
      await asReader(http().get('/alerts/inbox')).expect(404);
      expect(Object.values(discussion).every((f) => f.mock.calls.length === 0)).toBe(true);
      expect(Object.values(alerts).every((f) => f.mock.calls.length === 0)).toBe(true);
    });

    it('write requires read: DISCUSSION_WRITE_ENABLED alone exposes nothing', async () => {
      env = { DISCUSSION_WRITE_ENABLED: 'true' };
      await asReader(http().post('/discussion/comments')).send(post).expect(404);
      await http().get(`/discussion/articles/${REF_A}`).expect(404);
    });

    it('only the literal "true" enables a gate', async () => {
      for (const v of ['1', 'TRUE', 'yes', ' true']) {
        env = { DISCUSSION_READ_ENABLED: v, ALERTS_IN_APP_ENABLED: v };
        await http().get(`/discussion/articles/${REF_A}`).expect(404);
        await asReader(http().get('/alerts')).expect(404);
      }
    });
  });

  describe('discussion.read — public', () => {
    beforeEach(() => (env = { DISCUSSION_READ_ENABLED: 'true' }));

    it('anyone may read; the viewer is resolved only from a valid session, never from input', async () => {
      const anon = await http().get(`/discussion/articles/${REF_A}`).expect(200);
      expect(anon.body.viewer).toBeNull();
      const signed = await http().get(`/discussion/articles/${REF_A}?userId=forged`).set('Cookie', ['gna_session=reader-9']).expect(200);
      expect(signed.body.viewer).toBe('reader-9');
    });

    it('a malformed articleRef is refused', async () => {
      await http().get('/discussion/articles/not-a-ref').expect(400);
      await http().post('/discussion/counts').send({ articleRefs: ['x'] }).expect(400);
    });

    it('write stays 404 while only read is on', async () => {
      await asReader(http().post('/discussion/comments')).send(post).expect(404);
    });
  });

  describe('discussion.write — signed in + CSRF', () => {
    beforeEach(() => (env = { DISCUSSION_READ_ENABLED: 'true', DISCUSSION_WRITE_ENABLED: 'true' }));

    it('signed-out → 401; no CSRF → 403; both → the session user is the author', async () => {
      await http().post('/discussion/comments').send(post).expect(401);
      await noCsrf(http().post('/discussion/comments')).send(post).expect(403);
      const ok = await asReader(http().post('/discussion/comments')).send(post).expect(201);
      expect(ok.body.userId).toBe('reader-1');
      expect(discussion.post).toHaveBeenCalledWith('reader-1', expect.objectContaining({ articleRef: REF_A }));
    });

    it('a body cannot name the author or smuggle fields', async () => {
      await asReader(http().post('/discussion/comments')).send({ ...post, userId: 'victim' }).expect(400);
      expect(discussion.post).not.toHaveBeenCalled();
    });

    it('edit / delete / report pass the session user (ownership is enforced in the service query)', async () => {
      await asReader(http().post(`/discussion/comments/${COMMENT}/edit`), 'reader-2').send({ body: 'edited' }).expect(200);
      expect(discussion.edit).toHaveBeenCalledWith('reader-2', COMMENT, 'edited');
      await asReader(http().delete(`/discussion/comments/${COMMENT}`), 'reader-2').expect(204);
      expect(discussion.remove).toHaveBeenCalledWith('reader-2', COMMENT);
      await asReader(http().post(`/discussion/comments/${COMMENT}/report`), 'reader-3').send({ reason: 'SPAM' }).expect(204);
      await asReader(http().post(`/discussion/comments/${COMMENT}/report`), 'reader-3').send({ reason: 'BORING' }).expect(400);
    });
  });

  describe('moderation — the existing admin stack, news.manage', () => {
    beforeEach(() => (env = { ADMIN_PLATFORM_ENABLED: 'true' }));
    const moderate = { action: 'HIDE', reason: 'Spam link' };

    it('admin platform OFF → 404', async () => {
      env = {};
      await asReader(http().post(`/admin/stories/discussion/comments/${COMMENT}/moderate`), 'admin-1').send(moderate).expect(404);
    });

    it('signed-out 401; a reader 403; SUPPORT / ANALYST 403; ADMIN and SUPER_ADMIN allowed', async () => {
      await http().post(`/admin/stories/discussion/comments/${COMMENT}/moderate`).send(moderate).expect(401);
      for (const who of ['reader-1', 'support-1', 'analyst-1']) {
        await asReader(http().post(`/admin/stories/discussion/comments/${COMMENT}/moderate`), who).send(moderate).expect(403);
        await asReader(http().post(`/admin/stories/${STORY}/discussion/lock`), who).send({ locked: true, reason: 'Heated' }).expect(403);
        await asReader(http().post('/admin/stories/merge'), who).send({ survivorId: STORY, mergedId: OTHER, reason: 'Same event' }).expect(403);
        await asReader(http().get('/admin/stories/discussion/reports'), who).expect(403);
      }
      expect(discussion.moderate).not.toHaveBeenCalled();
      expect(identity.merge).not.toHaveBeenCalled();
      for (const who of ['admin-1', 'super-1']) {
        await asReader(http().post(`/admin/stories/discussion/comments/${COMMENT}/moderate`), who).send(moderate).expect(200);
      }
      expect(discussion.moderate).toHaveBeenLastCalledWith('super-1', COMMENT, 'HIDE', 'Spam link');
    });

    it('moderation mutations need CSRF and a stated reason', async () => {
      await noCsrf(http().post(`/admin/stories/discussion/comments/${COMMENT}/moderate`), 'admin-1').send(moderate).expect(403);
      await asReader(http().post(`/admin/stories/discussion/comments/${COMMENT}/moderate`), 'admin-1').send({ action: 'HIDE' }).expect(400);
      await asReader(http().post(`/admin/stories/discussion/comments/${COMMENT}/moderate`), 'admin-1').send({ action: 'DELETE_USER', reason: 'nope' }).expect(400);
    });

    it('moderation stays reachable while the reader gates are OFF (rollback stays moderatable)', async () => {
      await asReader(http().post(`/admin/stories/${STORY}/discussion/lock`), 'admin-1').send({ locked: true, reason: 'Heated' }).expect(200);
      expect(discussion.setLock).toHaveBeenCalledWith('admin-1', STORY, true, 'Heated');
    });
  });

  describe('alerts.inApp — signed in, owner-scoped', () => {
    beforeEach(() => (env = { ALERTS_IN_APP_ENABLED: 'true' }));

    it('signed-out 401; create needs CSRF; the session user owns it', async () => {
      await http().get('/alerts').expect(401);
      await noCsrf(http().post('/alerts')).send({ articleRef: REF_A, url: URL_A }).expect(403);
      const ok = await asReader(http().post('/alerts')).send({ articleRef: REF_A, url: URL_A }).expect(200);
      expect(ok.body.userId).toBe('reader-1');
    });

    it('only governed ops; unknown ops are refused', async () => {
      await asReader(http().post(`/alerts/${COMMENT}/pause`)).expect(200);
      expect(alerts.apply).toHaveBeenCalledWith('reader-1', COMMENT, 'pause');
      await asReader(http().post(`/alerts/${COMMENT}/deliver`)).expect(400);
      await asReader(http().post(`/alerts/${COMMENT}/email`)).expect(400);
    });

    it('the Replies tab follows discussion.read (discussion content only where Discussion exists)', async () => {
      const off = await asReader(http().get('/alerts/inbox')).expect(200);
      expect(off.body.replies).toBe(false);
      env = { ALERTS_IN_APP_ENABLED: 'true', DISCUSSION_READ_ENABLED: 'true' };
      const on = await asReader(http().get('/alerts/inbox')).expect(200);
      expect(on.body.replies).toBe(true);
    });
  });
});

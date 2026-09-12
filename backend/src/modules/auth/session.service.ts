import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { generateRawSessionToken, hashSessionToken } from './session-token.util';

/** Milestone #57 — 30 days. Sessions are opaque server-side records, so this can be tuned freely without any client-side token-format implication. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface CreatedSession {
  rawToken: string;
  expiresAt: Date;
}

/**
 * Milestone #57 — the sole place a raw session token is ever generated,
 * hashed, compared, or looked up. Every method here either returns the
 * raw token exactly once (createSession, for cookie-setting) or never
 * returns it at all (validateSession only returns the associated
 * userId) — a raw token is never logged, never persisted, and never
 * echoed back once issued.
 */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string): Promise<CreatedSession> {
    const rawToken = generateRawSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: { tokenHash, userId, expiresAt },
    });

    return { rawToken, expiresAt };
  }

  /**
   * Returns null for a missing, unrecognized, or expired session —
   * every caller must treat all three identically (unauthenticated),
   * never distinguishing them in a way that could leak whether a
   * given token value was ever valid.
   */
  async validateSession(rawToken: string): Promise<{ userId: string } | null> {
    const tokenHash = hashSessionToken(rawToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });

    if (!session) return null;

    if (session.expiresAt.getTime() < Date.now()) {
      // Milestone #57 — lazily clean up an expired row on read. Best
      // effort: if the delete itself fails, the session is still
      // correctly rejected below (returning null) regardless.
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    return { userId: session.userId };
  }

  async deleteSession(rawToken: string): Promise<void> {
    const tokenHash = hashSessionToken(rawToken);
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }
}

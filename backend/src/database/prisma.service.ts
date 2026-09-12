import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * S1 — the connection-pool maximum, made explicit.
 *
 * Before S1 this adapter was constructed with a connection string and nothing
 * else, so `pg-pool`'s own default applied: TEN connections for the entire
 * backend (node_modules/pg-pool/index.js — `this.options.max = this.options.max
 * || this.options.poolSize || 10`).
 *
 * That number was never a decision, and it is the shared resource every other
 * concern competes for: news reads, OAuth session lookups, telemetry writes,
 * and the readiness probe all draw from the same pool. It is what turns a
 * flood against any one endpoint into a whole-product outage rather than a
 * single feature degrading — which is precisely why it belongs in
 * configuration with a rationale attached rather than in a library default.
 *
 * The default below is deliberately the SAME 10, so a deployment that sets
 * nothing behaves exactly as it did before this change. Nothing is silently
 * retuned; the number is simply now visible and adjustable.
 *
 * SIZING IT. More is not better. Every connection is a real PostgreSQL backend
 * process, and the ceiling that matters is the server's own `max_connections`
 * shared across every replica: replicas x DB_POOL_MAX must stay comfortably
 * below it, or the database starts refusing connections outright — a far worse
 * failure than requests queueing briefly for a pool slot.
 */
const DEFAULT_POOL_MAX = 10;

/**
 * Parsed defensively and NEVER thrown on. An unusable value falls back to the
 * documented default rather than preventing the application from starting: a
 * mistyped pool size is a performance problem, and refusing to boot over one
 * would turn it into an outage. The value is logged nowhere here because
 * PrismaService is constructed before the Nest logger context exists; the
 * chosen size is documented in .env.example instead.
 */
export function resolvePoolMax(rawValue: string | undefined): number {
  if (rawValue === undefined) {
    return DEFAULT_POOL_MAX;
  }

  const parsed = Number(rawValue.trim());

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_POOL_MAX;
  }

  return parsed;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    const adapter = new PrismaPg({
      connectionString,
      // S1 — see DEFAULT_POOL_MAX above. Same effective value as before when
      // DB_POOL_MAX is unset.
      max: resolvePoolMax(process.env.DB_POOL_MAX),
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

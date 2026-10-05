import { BadRequestException, Controller, Get, Header, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  HOME_REGION_ORDER,
  STORY_SEARCH_MAX_LENGTH,
  type HomeEditorialDomain,
  type HomeEditorialResponse,
  type HomeRegionId,
  type StorySearchResponse,
} from '@globalnews-ai/shared';
import { SessionService } from '../auth/session.service';
import { resolveAuthCookieNames } from '../auth/cookie.util';
import { HomeEditorialService } from './home-editorial.service';

/**
 * PHONE-FIRST HOME CORRECTION R1 — public, read-only, retained-store reads:
 *   GET /home/editorial     hero ("Your world in 60 seconds") + East Africa / EU / Middle East rows
 *   GET /stories/search     persisted story search (never Ask, never a provider, never AI)
 *
 * Signed-in is OPTIONAL: a valid session cookie only personalises the hero from the reader's OWN
 * saved follows/interests. An invalid or absent session is simply the default — never an error,
 * and never another reader's data.
 */
@Controller()
export class HomeEditorialController {
  constructor(
    private readonly service: HomeEditorialService,
    private readonly sessions: SessionService,
  ) {}

  private async optionalUserId(request: Request): Promise<string | null> {
    const raw = request.cookies?.[resolveAuthCookieNames().session] as string | undefined;
    if (!raw) return null;
    try {
      const session = await this.sessions.validateSession(raw);
      return session?.userId ?? null;
    } catch {
      return null;
    }
  }

  @Get('home/editorial')
  @Header('Cache-Control', 'private, no-store')
  async editorial(@Req() request: Request): Promise<HomeEditorialResponse> {
    return this.service.editorial(await this.optionalUserId(request));
  }

  @Get('stories/search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  async search(
    @Query('q') q?: string,
    @Query('scope') scope?: string,
    @Query('region') region?: string,
    @Query('domain') domain?: string,
    @Query('days') days?: string,
  ): Promise<StorySearchResponse> {
    if (typeof q !== 'string') throw new BadRequestException('q is required');
    if (q.length > STORY_SEARCH_MAX_LENGTH * 2) throw new BadRequestException('q is too long');
    const parsedRegion = region === undefined || region === '' ? null : (HOME_REGION_ORDER as readonly string[]).includes(region) ? (region as HomeRegionId) : undefined;
    if (parsedRegion === undefined) throw new BadRequestException('unknown region');
    const parsedDomain = domain === undefined || domain === '' ? null : domain === 'business' || domain === 'conflict' ? (domain as HomeEditorialDomain) : undefined;
    if (parsedDomain === undefined) throw new BadRequestException('unknown domain');
    const parsedDays = days === undefined || days === '' ? null : Number(days);
    if (parsedDays !== null && (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 3650)) throw new BadRequestException('days must be 1–3650');
    if (scope !== undefined && scope !== '' && scope !== 'home' && scope !== 'all') throw new BadRequestException('unknown scope');
    return this.service.search({
      q,
      scope: scope === 'all' ? 'ALL_RETAINED' : 'HOME_ELIGIBLE',
      region: parsedRegion,
      domain: parsedDomain,
      days: parsedDays,
    });
  }
}

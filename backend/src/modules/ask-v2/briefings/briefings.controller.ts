import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { ASK_INPUT_MAX_CHARS } from '@globalnews-ai/shared';
import { RequireAuthGuard } from '../../auth/require-auth.guard';
import { CsrfGuard } from '../../auth/csrf.guard';
import { CurrentUser } from '../../users/current-user.decorator';
import { AskV2EnabledGuard } from '../ask-v2.controller';
import { BRIEFING_TITLE_MAX, BriefingsService } from './briefings.service';

export class CreateBriefingDto {
  @IsUUID() turnId!: string;
  @IsOptional() @IsString() @Length(1, BRIEFING_TITLE_MAX) title?: string;
  @IsOptional() @Matches(/^[A-Za-z]{3}$/) countryCode?: string;
  @IsOptional() @IsString() @Length(1, 64) storyId?: string;
}

export class AddBriefingVersionDto {
  @IsUUID() turnId!: string;
}

/** REASON TO RETURN R1 · §8 — the reader's own Ask turn that ran as a check. */
export class RecordBriefingCheckDto {
  @IsUUID() turnId!: string;
}

/** REASON TO RETURN R1 · G8 — rename, pause/resume, edit the followed question. */
export class UpdateBriefingDto {
  @IsOptional() @IsString() @Length(1, BRIEFING_TITLE_MAX) title?: string;
  @IsOptional() @IsIn(['ACTIVE', 'PAUSED']) status?: 'ACTIVE' | 'PAUSED';
  @IsOptional() @IsString() @Length(2, ASK_INPUT_MAX_CHARS) question?: string;
}

/**
 * R2 · D1 — briefings are OFF unless `ASK_BRIEFINGS_ENABLED` is exactly 'true' (fail-closed, the
 * same literal rule as every Ask switch). Off is a bare 404, so the surface does not exist.
 */
@Injectable()
export class BriefingsEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(_context: ExecutionContext): boolean {
    if (this.config.get<string>('ASK_BRIEFINGS_ENABLED') !== 'true') throw new NotFoundException();
    return true;
  }
}

/**
 * R2 · D1 — the reader's own briefings. Signed-in only (guests have no durable artifacts);
 * mutations carry CSRF. Share and export do not exist.
 */
@Controller('ask-v2/briefings')
@UseGuards(AskV2EnabledGuard, BriefingsEnabledGuard, RequireAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BriefingsController {
  constructor(private readonly briefings: BriefingsService) {}

  @Get() list(@CurrentUser() user: { id: string }) {
    return this.briefings.list(user.id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBriefingDto) {
    return this.briefings.create(user.id, dto);
  }

  @Get(':id') get(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.briefings.get(user.id, id);
  }

  @Get(':id/versions/:version') version(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.briefings.getVersion(user.id, id, version);
  }

  @Post(':id/versions')
  @UseGuards(CsrfGuard)
  addVersion(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddBriefingVersionDto,
  ) {
    return this.briefings.addVersion(user.id, id, dto.turnId);
  }

  /* REASON TO RETURN R1 · §8 — record a manual check (the turn already ran; no AI here). */
  @Post(':id/checks')
  @UseGuards(CsrfGuard)
  recordCheck(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordBriefingCheckDto,
  ) {
    return this.briefings.recordCheck(user.id, id, dto.turnId);
  }

  @Patch(':id')
  @UseGuards(CsrfGuard)
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBriefingDto,
  ) {
    return this.briefings.update(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(CsrfGuard)
  remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.briefings.remove(user.id, id);
  }
}

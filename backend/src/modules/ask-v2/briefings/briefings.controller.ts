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
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
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

  @Delete(':id')
  @UseGuards(CsrfGuard)
  remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.briefings.remove(user.id, id);
  }
}

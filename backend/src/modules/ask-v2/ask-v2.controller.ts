import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../users/current-user.decorator';
import { CreateThreadDto, HistoryPageDto, QuoteTurnDto } from './ask-v2.dto';
import { AskV2Service } from './ask-v2.service';

/**
 * ASK R2 INTEGRATION R1 · §14 — PRIVACY HEADERS ON EVERY ASK V2 RESPONSE.
 *
 * Set BEFORE the enable check and before authentication, so they ride every outcome the
 * route family can produce — success, the disabled 404, the unauthenticated 401, the
 * owner-sensitive 404 for someone else's operation, conflicts and refusals. A response
 * that varies by session cookie but is cacheable, or that is private on success and
 * public on refusal, leaks whether an account-owned operation exists.
 */
export function applyAskPrivacyHeaders(response: {
  setHeader(name: string, value: string): void;
  getHeader?(name: string): unknown;
}): void {
  response.setHeader('Cache-Control', 'private, no-store');
  const existing = response.getHeader?.('Vary');
  const vary =
    typeof existing === 'string' && existing.length > 0
      ? existing.split(',').map((v) => v.trim())
      : [];
  if (!vary.some((v) => v.toLowerCase() === 'cookie')) vary.push('Cookie');
  response.setHeader('Vary', vary.join(', '));
}

@Injectable()
export class AskV2EnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    applyAskPrivacyHeaders(context.switchToHttp().getResponse());
    if (this.config.get<string>('ASK_V2_ENABLED') !== 'true') throw new NotFoundException();
    return true;
  }
}
@Controller('ask-v2')
@UseGuards(AskV2EnabledGuard, RequireAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AskV2Controller {
  constructor(private readonly ask: AskV2Service) {}
  @Get('threads') list(@CurrentUser() user: { id: string }) {
    return this.ask.listThreads(user.id);
  }
  @Get('threads/:id') history(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query() page: HistoryPageDto,
  ) {
    return this.ask.getThread(user.id, id, page.after);
  }
  @Get('operations/:id') operation(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.getOperation(user.id, id);
  }
  @Post('threads')
  @UseGuards(CsrfGuard)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateThreadDto) {
    return this.ask.createThread(user.id, dto);
  }
  @Post('threads/:id/turns')
  @UseGuards(CsrfGuard)
  submit(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuoteTurnDto) {
    return this.ask.submit(user.id, id, dto);
  }
  @Post('threads/:id/quote')
  @UseGuards(CsrfGuard)
  quote(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuoteTurnDto) {
    return this.ask.quote(user.id, id, dto);
  }
  @Post('operations/:id/accept')
  @UseGuards(CsrfGuard)
  accept(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.accept(user.id, id);
  }
  @Post('operations/:id/reserve')
  @UseGuards(CsrfGuard)
  reserve(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.reserve(user.id, id);
  }
  @Post('operations/:id/execute')
  @UseGuards(CsrfGuard)
  execute(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.execute(user.id, id);
  }
  @Post('operations/:id/release')
  @UseGuards(CsrfGuard)
  release(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ask.release(user.id, id);
  }
}

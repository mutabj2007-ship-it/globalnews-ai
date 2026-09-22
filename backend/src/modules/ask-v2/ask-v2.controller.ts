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

@Injectable()
export class AskV2EnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<string>('ASK_V2_ENABLED') !== 'true') throw new NotFoundException();
    context.switchToHttp().getResponse().setHeader('Cache-Control', 'private, no-store');
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

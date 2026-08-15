import { Controller, Delete, Get, HttpCode, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from './current-user.decorator';
import { UsersService, type UserSummary } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(RequireAuthGuard)
  async me(@CurrentUser() user: { id: string }): Promise<UserSummary | null> {
    return this.usersService.getById(user.id);
  }

  @Delete('me')
  @UseGuards(RequireAuthGuard, CsrfGuard)
  @HttpCode(204)
  async deleteMe(@CurrentUser() user: { id: string }): Promise<void> {
    await this.usersService.deleteAccount(user.id);
  }
}

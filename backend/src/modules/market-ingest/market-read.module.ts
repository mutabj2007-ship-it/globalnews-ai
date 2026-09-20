import { Module } from '@nestjs/common';
import { MarketReadController } from './market-read.controller';
import { MarketReadRepository } from './market-read.repository';

/**
 * Reader-only Market module. It intentionally does NOT import any Market
 * provider, scheduler or transport adapter.
 */
@Module({
  controllers: [MarketReadController],
  providers: [MarketReadRepository],
})
export class MarketReadModule {}

import { Controller, Get, Module } from '@nestjs/common';
import { EnergyReadRepository } from './energy-read.repository';
@Controller('energy')
export class EnergyReadController {
  constructor(private readonly repository: EnergyReadRepository) {}
  @Get('observations')
  observations() {
    return this.repository.latest();
  }
}
/** Read-only. No producer, external transport, scheduler, or admission endpoint. */
@Module({ controllers: [EnergyReadController], providers: [EnergyReadRepository] })
export class EnergyReadModule {}

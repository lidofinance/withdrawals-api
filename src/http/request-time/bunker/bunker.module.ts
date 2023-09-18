import { Module } from '@nestjs/common';
import { BunkerService } from './bunker.service';

@Module({
  providers: [BunkerService]
})
export class BunkerModule {}

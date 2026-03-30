import { Module } from '@nestjs/common';
import { JobModule } from 'common/job';
import { ConfigModule } from 'common/config';
import { GenesisTimeModule } from '../../common/genesis-time';
import { SpecJobService } from './spec.service';

@Module({
  imports: [JobModule, ConfigModule, GenesisTimeModule],
  providers: [SpecJobService],
  exports: [SpecJobService],
})
export class SpecJobModule {}

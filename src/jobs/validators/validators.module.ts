import { Module } from '@nestjs/common';
import { JobModule } from 'common/job';
import { GenesisTimeModule } from 'common/genesis-time';
import { ValidatorsStorageModule } from 'storage';
import { ValidatorsService } from './validators.service';
import { LidoKeysModule } from './lido-keys';

@Module({
  imports: [JobModule, ValidatorsStorageModule, GenesisTimeModule, LidoKeysModule],
  providers: [ValidatorsService],
  exports: [ValidatorsService],
})
export class ValidatorsModule {}

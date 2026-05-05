import { Module } from '@nestjs/common';
import { JobModule } from 'common/job';
import { ContractConfigService } from './contract-config.service';
import { LidoExtensionReader } from './lido-extension-reader';
import { OracleLimitsReader } from './oracle-limits-reader';
import { ContractConfigStorageModule } from 'storage';
import { ValidatorsModule } from '../validators';

@Module({
  imports: [JobModule, ContractConfigStorageModule, ValidatorsModule],
  providers: [ContractConfigService, OracleLimitsReader, LidoExtensionReader],
  // LidoExtensionReader is also consumed by BlockStateCacheService (waiting-time); a single
  // instance is required so the in-memory `supportedLatched` flag is shared across consumers.
  exports: [ContractConfigService, LidoExtensionReader],
})
export class ContractConfigModule {}

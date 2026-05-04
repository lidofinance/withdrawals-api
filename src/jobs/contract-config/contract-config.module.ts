import { Module } from '@nestjs/common';
import { JobModule } from 'common/job';
import { ContractConfigService } from './contract-config.service';
import { ContractConfigStorageModule } from 'storage';
import { ValidatorsModule } from '../validators';

@Module({
  imports: [JobModule, ContractConfigStorageModule, ValidatorsModule],
  providers: [ContractConfigService],
  exports: [ContractConfigService],
})
export class ContractConfigModule {}

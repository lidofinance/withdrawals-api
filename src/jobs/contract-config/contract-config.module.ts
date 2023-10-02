import { Module } from '@nestjs/common';
import { JobModule } from 'common/job';
import { ContractConfigService } from './contract-config.service';
import { ContractConfigStorageModule } from 'storage';

@Module({
  imports: [JobModule, ContractConfigStorageModule],
  providers: [ContractConfigService],
  exports: [ContractConfigService],
})
export class ContractConfigModule {}

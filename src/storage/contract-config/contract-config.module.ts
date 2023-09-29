import { Module } from '@nestjs/common';
import { ContractConfigStorageService } from './contract-config.service';

@Module({
  providers: [ContractConfigStorageService],
  exports: [ContractConfigStorageService],
})
export class ContractConfigStorageModule {}

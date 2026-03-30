import { Module } from '@nestjs/common';

import { JobsService } from './jobs.service';
import { ValidatorsModule } from './validators';
import { QueueInfoModule } from './queue-info';
import { ContractConfigModule } from './contract-config';
import { SpecJobModule } from './spec';

@Module({
  imports: [ValidatorsModule, QueueInfoModule, ContractConfigModule, SpecJobModule],
  providers: [JobsService],
})
export class JobsModule {}

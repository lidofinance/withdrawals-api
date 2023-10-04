import { Module } from '@nestjs/common';

import { JobsService } from './jobs.service';
import { ValidatorsModule } from './validators';
import { QueueInfoModule } from './queue-info';
import { ContractConfigModule } from './contract-config';

@Module({
  imports: [ValidatorsModule, QueueInfoModule, ContractConfigModule],
  providers: [JobsService],
})
export class JobsModule {}

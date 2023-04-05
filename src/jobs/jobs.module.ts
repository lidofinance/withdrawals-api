import { Module } from '@nestjs/common';

import { JobsService } from './jobs.service';
import { ValidatorsModule } from './validators';
import { QueueInfoModule } from './queueInfo';

@Module({
  imports: [ValidatorsModule, QueueInfoModule],
  providers: [JobsService],
})
export class JobsModule {}

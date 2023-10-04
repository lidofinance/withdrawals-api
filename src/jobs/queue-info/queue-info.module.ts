import { Module } from '@nestjs/common';
import { JobModule } from 'common/job';
import { QueueInfoStorageModule } from 'storage';
import { QueueInfoService } from './queue-info.service';

@Module({
  imports: [JobModule, QueueInfoStorageModule],
  providers: [QueueInfoService],
  exports: [QueueInfoService],
})
export class QueueInfoModule {}

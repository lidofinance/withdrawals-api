import { Module } from '@nestjs/common';
import { QueueInfoStorageService } from './queue-info.service';

@Module({
  providers: [QueueInfoStorageService],
  exports: [QueueInfoStorageService],
})
export class QueueInfoStorageModule {}

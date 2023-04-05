import { Module } from '@nestjs/common';
import { QueueInfoStorageService } from './queueInfo.service';

@Module({
  providers: [QueueInfoStorageService],
  exports: [QueueInfoStorageService],
})
export class QueueInfoStorageModule {}

import { Module } from '@nestjs/common';

import { ValidatorsStorageModule, QueueInfoStorageModule } from 'storage';
import { WaitingTimeModule } from 'waiting-time';
import { MinWithdrawableEtherValidator } from 'common/validators/min-withdrawable-ether.validator';

import { RequestTimeController } from './request-time.controller';
import { RequestTimeService } from './request-time.service';

@Module({
  imports: [ValidatorsStorageModule, QueueInfoStorageModule, WaitingTimeModule],
  controllers: [RequestTimeController],
  providers: [RequestTimeService, MinWithdrawableEtherValidator],
})
export class RequestTimeModule {}

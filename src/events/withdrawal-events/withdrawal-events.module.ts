import { Module } from '@nestjs/common';
import { WithdrawalEventsService } from './withdrawal-events.service';
import { GenesisTimeModule } from '../../common/genesis-time';
import { WaitingTimeModule } from '../../waiting-time';
import { RewardEventsModule } from '../reward-events';

@Module({
  imports: [GenesisTimeModule, WaitingTimeModule, RewardEventsModule],
  providers: [WithdrawalEventsService],
  exports: [WithdrawalEventsService],
})
export class WithdrawalEventsModule {}

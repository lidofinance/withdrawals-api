import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawalEventsService } from './withdrawal-events.service';
import { GenesisTimeModule } from '../../common/genesis-time';
import { WaitingTimeModule, WithdrawalRequestInfoEntity } from '../../waiting-time';
import { RewardEventsModule } from '../reward-events';

@Module({
  imports: [
    TypeOrmModule.forFeature([WithdrawalRequestInfoEntity]),
    GenesisTimeModule,
    WaitingTimeModule,
    RewardEventsModule,
  ],
  providers: [WithdrawalEventsService],
  exports: [WithdrawalEventsService],
})
export class WithdrawalEventsModule {}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { WaitingTimeCalculationType } from './withdrawal-time-calculation-type.enum';

@Entity('withdrawal_request_info')
export class WithdrawalRequestInfoEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'request_id', type: 'int', unique: true })
  requestId: number;

  @Column({ name: 'amount', type: 'varchar' })
  amount: string;

  @Column({ name: 'request_epoch', type: 'int' })
  requestEpoch: number;

  @Column({ name: 'request_timestamp', type: 'timestamptz' })
  requestTimestamp: Date;

  // first
  @Column({ name: 'first_calculated_finalization_timestamp', type: 'timestamptz', nullable: true })
  firstCalculatedFinalizationTimestamp: Date;

  @Column({
    name: 'first_calculated_finalization_type',
    type: 'enum',
    enum: WaitingTimeCalculationType,
    enumName: 'waiting_time_calculation_type',
    nullable: true,
  })
  firstCalculatedFinalizationType: WaitingTimeCalculationType;

  // last
  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  finalizedAt: Date;

  @Column({ name: 'max_exit_epoch_at_request_timestamp', type: 'int', nullable: true })
  maxExitEpochAtRequestTimestamp: number;

  @UpdateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @CreateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // todo backtrace of all balances
}

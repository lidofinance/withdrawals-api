import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { WaitingTimeCalculationType } from '../../../waiting-time';

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
  @Column({ name: 'last_calculated_finalization_timestamp', type: 'timestamptz', nullable: true })
  lastCalculatedFinalizationTimestamp: Date;

  @Column({
    name: 'last_calculated_finalization_type',
    type: 'enum',
    enum: WaitingTimeCalculationType,
    enumName: 'waiting_time_calculation_type',
    nullable: true,
  })
  lastCalculatedFinalizationType: WaitingTimeCalculationType;

  // min
  @Column({ name: 'min_calculated_finalization_timestamp', type: 'timestamptz', nullable: true })
  minCalculatedFinalizationTimestamp: Date;

  @Column({
    name: 'min_calculated_finalization_type',
    type: 'enum',
    enum: WaitingTimeCalculationType,
    enumName: 'waiting_time_calculation_type',
    nullable: true,
  })
  minCalculatedFinalizationType: WaitingTimeCalculationType;

  @Column({ name: 'max_exit_epoch_at_request_timestamp', type: 'int', nullable: true })
  maxExitEpochAtRequestTimestamp: number;

  @UpdateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @CreateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

// RequestInfo {
//     - id
//     - updatedAt
//     - createdAt
//     - requestId
//     - requestTimestamp
//     - amount

//     - firstCalculatedFinalizationTimestamp
//     - firstCalculatedFinalizationType
//     - lastCalculatedFinalizationTimestamp
//     - lastCalculatedFinalizationType
//     - minCalculatedFinalizationTimestamp
//     - minCalculatedFinalizationType
//     - maxExitEpochAtRequestTimestamp
// }

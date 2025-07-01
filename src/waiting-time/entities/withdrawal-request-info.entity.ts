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

  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  finalizedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { ConsensusExecutionPayloadService, ConsensusProviderService } from 'common/consensus-provider';
import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from './genesis-time.constants';
import { ContractConfigStorageService } from '../../storage';

@Injectable()
export class GenesisTimeService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly consensusService: ConsensusProviderService,
    protected readonly consensusExecutionPayloadService: ConsensusExecutionPayloadService,
    protected readonly contractConfig: ContractConfigStorageService,
  ) {}

  public async onModuleInit(): Promise<void> {
    await Promise.all([this.initGenesisTime(), this.initSecondsPerSlot()]);
  }

  /**
   * Calculates timestamp by slot number
   * @param slotNumber - slot number
   * @returns - slot timestamp
   */
  public getSlotTime(slotNumber: number): number {
    return this.genesisTime + slotNumber * this.getSecondsPerSlot();
  }

  public getGenesisTime() {
    return this.genesisTime;
  }

  public getSecondsPerSlot() {
    return this.secondsPerSlot;
  }

  /**
   * Calculates number of slots from passed slot number to now
   * @param fromSlot - slot number
   * @returns - amount of slots
   */
  public getSlotsToNow(fromSlot: number) {
    const currentSlotTime = Math.floor(Date.now() / 1000);
    const fromSlotTime = this.getSlotTime(fromSlot);
    const deltaTime = currentSlotTime - fromSlotTime;
    return Math.floor(deltaTime / this.getSecondsPerSlot());
  }

  public getCurrentSlot() {
    const currentSlotTime = Math.floor(Date.now() / 1000);
    const time = currentSlotTime - this.genesisTime;
    return Math.floor(time / this.getSecondsPerSlot());
  }

  public getCurrentEpoch() {
    const currentTime = Math.floor(Date.now() / 1000);
    const genesisTime = this.getGenesisTime();

    return Math.floor((currentTime - genesisTime) / this.getSecondsPerSlot() / SLOTS_PER_EPOCH);
  }

  public getFrameOfEpoch(epoch: number) {
    return Math.floor((epoch - this.contractConfig.getInitialEpoch()) / this.contractConfig.getEpochsPerFrame());
  }

  timeToWithdrawalFrame(frame: number, from: number): number {
    const genesisTime = this.getGenesisTime();
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();
    const epochOfNextReport = this.contractConfig.getInitialEpoch() + frame * epochPerFrame;
    const timeToNextReport = epochOfNextReport * this.getSecondsPerSlot() * SLOTS_PER_EPOCH;

    return Math.round(genesisTime + timeToNextReport - from / 1000) * 1000; // in ms
  }

  getFrameByTimestamp(timestamp: number): number {
    const genesisTime = this.getGenesisTime();
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();
    const secondsFromInitialEpochToTimestamp =
      timestamp / 1000 -
      (genesisTime + this.contractConfig.getInitialEpoch() * this.getSecondsPerSlot() * SLOTS_PER_EPOCH);
    return Math.floor(
      secondsFromInitialEpochToTimestamp / (epochPerFrame * this.getSecondsPerSlot() * SLOTS_PER_EPOCH),
    );
  }

  getSlotByTimestamp(timestamp: number): number {
    const currentSlotTime = Math.floor(timestamp / 1000);
    const time = currentSlotTime - this.genesisTime;
    return Math.floor(time / this.getSecondsPerSlot());
  }

  getEpochByTimestamp(timestamp: number): number {
    return Math.floor(this.getSlotByTimestamp(timestamp) / SLOTS_PER_EPOCH);
  }

  async getBlockBySlot(slot: number) {
    const blockId = `${slot}`;
    const executionPayload = await this.consensusExecutionPayloadService.getExecutionPayload(blockId);
    return Number(executionPayload.block_number);
  }

  getTimestampByEpoch(epoch: number) {
    return this.genesisTime * 1000 + epoch * SLOTS_PER_EPOCH * this.getSecondsPerSlot() * 1000;
  }

  protected genesisTime = -1;
  protected secondsPerSlot = SECONDS_PER_SLOT;

  protected async initSecondsPerSlot() {
    try {
      const spec = await this.consensusService.getSpec();
      const secondsPerSlot = Number(spec.data.SECONDS_PER_SLOT);

      if (Number.isFinite(secondsPerSlot) && secondsPerSlot > 0) {
        this.secondsPerSlot = secondsPerSlot;
        return;
      }

      this.logger.warn(`Failed to parse SECONDS_PER_SLOT from consensus spec, fallback to ${SECONDS_PER_SLOT}`);
    } catch (error) {
      this.logger.warn(`Failed to load SECONDS_PER_SLOT from consensus spec: ${error.message}`);
    }

    this.secondsPerSlot = SECONDS_PER_SLOT;
  }

  protected async initGenesisTime() {
    const genesis = await this.consensusService.getGenesis();
    const genesisTime = Number(genesis.data.genesis_time);

    if (isNaN(genesisTime)) {
      throw new Error('Failed to get genesis time');
    }

    this.genesisTime = genesisTime;
  }
}

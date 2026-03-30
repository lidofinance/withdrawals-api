import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { FAR_FUTURE_EPOCH } from 'common/constants';
import { ConsensusProviderService } from 'common/consensus-provider';
import { ConsensusClientService } from 'common/consensus-provider/consensus-client.service';
import { SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from './genesis-time.constants';
import { ContractConfigStorageService } from '../../storage';

@Injectable()
export class GenesisTimeService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly consensusService: ConsensusProviderService,
    protected readonly consensusClientService: ConsensusClientService,
    protected readonly contractConfig: ContractConfigStorageService,
  ) {}

  public async onModuleInit(): Promise<void> {
    const genesis = await this.consensusService.getGenesis();
    this.genesisTime = Number(genesis.data.genesis_time);

    if (isNaN(this.genesisTime)) {
      throw new Error('Failed to get genesis time');
    }

    await this.loadGlamsterdamForkEpoch();
  }

  /**
   * Calculates timestamp by slot number
   * @param slotNumber - slot number
   * @returns - slot timestamp
   */
  public getSlotTime(slotNumber: number): number {
    return this.genesisTime + slotNumber * SECONDS_PER_SLOT;
  }

  public getGenesisTime() {
    return this.genesisTime;
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
    return Math.floor(deltaTime / SECONDS_PER_SLOT);
  }

  public getCurrentSlot() {
    const currentSlotTime = Math.floor(Date.now() / 1000);
    const time = currentSlotTime - this.genesisTime;
    return Math.floor(time / SECONDS_PER_SLOT);
  }

  public getCurrentEpoch() {
    const currentTime = Math.floor(Date.now() / 1000);
    const genesisTime = this.getGenesisTime();

    return Math.floor((currentTime - genesisTime) / SECONDS_PER_SLOT / SLOTS_PER_EPOCH);
  }

  public getFrameOfEpoch(epoch: number) {
    return Math.floor((epoch - this.contractConfig.getInitialEpoch()) / this.contractConfig.getEpochsPerFrame());
  }

  timeToWithdrawalFrame(frame: number, from: number): number {
    const genesisTime = this.getGenesisTime();
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();
    const epochOfNextReport = this.contractConfig.getInitialEpoch() + frame * epochPerFrame;
    const timeToNextReport = epochOfNextReport * SECONDS_PER_SLOT * SLOTS_PER_EPOCH;

    return Math.round(genesisTime + timeToNextReport - from / 1000) * 1000; // in ms
  }

  getFrameByTimestamp(timestamp: number): number {
    const genesisTime = this.getGenesisTime();
    const epochPerFrame = this.contractConfig.getEpochsPerFrame();
    const secondsFromInitialEpochToTimestamp =
      timestamp / 1000 - (genesisTime + this.contractConfig.getInitialEpoch() * SECONDS_PER_SLOT * SLOTS_PER_EPOCH);
    return Math.floor(secondsFromInitialEpochToTimestamp / (epochPerFrame * SECONDS_PER_SLOT * SLOTS_PER_EPOCH));
  }

  getSlotByTimestamp(timestamp: number): number {
    const currentSlotTime = Math.floor(timestamp / 1000);
    const time = currentSlotTime - this.genesisTime;
    return Math.floor(time / SECONDS_PER_SLOT);
  }

  getEpochByTimestamp(timestamp: number): number {
    return Math.floor(this.getSlotByTimestamp(timestamp) / SLOTS_PER_EPOCH);
  }

  async getBlockBySlot(slot: number) {
    const blockId = `${slot}`;

    if (this.isGlamsterdamReleasedAtSlot(slot)) {
      return this.consensusClientService.getExecutionPayloadEnvelopeBlockNumber(blockId);
    }

    const block = await this.consensusService.getBlockV2({ blockId });
    return Number((block.data as any).message.body.execution_payload.block_number);
  }

  getTimestampByEpoch(epoch: number) {
    return this.genesisTime * 1000 + epoch * SLOTS_PER_EPOCH * SECONDS_PER_SLOT * 1000;
  }

  public async refreshGlamsterdamForkEpoch(): Promise<void> {
    await this.loadGlamsterdamForkEpoch();
  }

  protected genesisTime = -1;
  protected glamsterdamForkEpoch: number | null = null;

  private async loadGlamsterdamForkEpoch(): Promise<void> {
    try {
      const spec = await this.consensusService.getSpec();
      const glamsterdamForkEpoch = spec.data.GLOAS_FORK_EPOCH;

      if (glamsterdamForkEpoch && glamsterdamForkEpoch !== FAR_FUTURE_EPOCH.toString()) {
        const nextForkEpoch = Number(glamsterdamForkEpoch);

        if (this.glamsterdamForkEpoch !== nextForkEpoch) {
          this.glamsterdamForkEpoch = nextForkEpoch;
          this.logger.log('Loaded GLOAS_FORK_EPOCH', { result: glamsterdamForkEpoch });
        }
        return;
      }
    } catch (error) {
      this.logger.warn(`Failed to load Glamsterdam fork epoch from consensus spec: ${error.message}`);
    }
  }

  private isGlamsterdamReleasedAtSlot(slot: number): boolean {
    if (this.glamsterdamForkEpoch === null) {
      return false;
    }

    return Math.floor(slot / SLOTS_PER_EPOCH) >= this.glamsterdamForkEpoch;
  }
}

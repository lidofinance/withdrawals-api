import { Inject, Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { ConsensusProviderService } from 'common/consensus-provider';
import { EPOCH_PER_FRAME, SECONDS_PER_SLOT, SLOTS_PER_EPOCH } from './genesis-time.constants';
import { ContractConfigStorageService } from '../../storage';

@Injectable()
export class GenesisTimeService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly consensusService: ConsensusProviderService,
    protected readonly contractConfig: ContractConfigStorageService,
  ) {}

  public async onModuleInit(): Promise<void> {
    const genesis = await this.consensusService.getGenesis();
    this.genesisTime = Number(genesis.data.genesis_time) ?? -1;

    if (this.genesisTime === -1) {
      throw new Error('Failed to get genesis time');
    }
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
    return Math.floor((epoch - this.contractConfig.getInitialEpoch()) / EPOCH_PER_FRAME);
  }

  protected genesisTime = -1;
}

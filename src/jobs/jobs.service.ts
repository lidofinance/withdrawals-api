import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from 'common/logger';
import { ValidatorsService } from './validators';
import { QueueInfoService } from './queue-info';
import { ContractConfigService } from './contract-config';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,

    protected readonly validatorsService: ValidatorsService,
    protected readonly queueInfoService: QueueInfoService,
    protected readonly contractConfigService: ContractConfigService,
  ) {}

  public async onModuleInit(): Promise<void> {
    // Do not wait for initialization to avoid blocking the main process
    this.initialize();
  }

  /**
   * Initializes jobs
   */
  protected async initialize(): Promise<void> {
    await Promise.all([
      this.validatorsService.initialize(),
      this.queueInfoService.initialize(),
      this.contractConfigService.initialize(),
    ]);
  }
}

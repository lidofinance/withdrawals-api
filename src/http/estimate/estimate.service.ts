import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';

import { ConfigService } from 'common/config';

import {
  ESTIMATE_ACCOUNT,
  ESTIMATE_ACCOUNT_PERMITS,
  WITHDRAWAL_QUEUE_REQUEST_STETH_PERMIT_GAS_LIMIT_DEFAULT,
  WITHDRAWAL_QUEUE_REQUEST_WSTETH_PERMIT_GAS_LIMIT_DEFAULT,
} from './estimate.constants';
import { EstimateDto, EstimateOptionsDto } from './dto';
import { BigNumber } from '@ethersproject/bignumber';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

@Injectable()
export class EstimateService {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contract: WithdrawalQueue,
  ) {}

  async getEstimate(params: EstimateOptionsDto): Promise<EstimateDto | null> {
    const { token, requestCount } = params;
    const isSteth = token === 'steth';
    const helperGasLimit =
      (isSteth
        ? WITHDRAWAL_QUEUE_REQUEST_STETH_PERMIT_GAS_LIMIT_DEFAULT
        : WITHDRAWAL_QUEUE_REQUEST_WSTETH_PERMIT_GAS_LIMIT_DEFAULT) * requestCount;

    const chainId = this.configService.get('CHAIN_ID');
    const permits = ESTIMATE_ACCOUNT_PERMITS[chainId];

    if (!permits) {
      return { gasLimit: helperGasLimit };
    }

    const permit = isSteth ? permits.steth_permit : permits.wsteth_permit;
    const method = isSteth
      ? this.contract.estimateGas.requestWithdrawalsWithPermit
      : this.contract.estimateGas.requestWithdrawalsWstETHWithPermit;

    try {
      const gasLimit = await method(Array(Number(requestCount)).fill(BigNumber.from(100)), ESTIMATE_ACCOUNT, permit, {
        from: ESTIMATE_ACCOUNT,
        gasLimit: helperGasLimit * 10,
      });

      return { gasLimit: gasLimit.toNumber() };
    } catch (error) {
      this.logger.error('Estimate error');

      return { gasLimit: helperGasLimit };
    }
  }
}

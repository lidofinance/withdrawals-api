import { Inject, Injectable } from '@nestjs/common';
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

@Injectable()
export class EstimateService {
  constructor(
    protected readonly configService: ConfigService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contract: WithdrawalQueue,
  ) {}

  async getEstimate(params: EstimateOptionsDto): Promise<EstimateDto | null> {
    const isDisable = this.configService.get('HIDE_NFT');

    const { token, requestCount } = params;
    const chainId = this.configService.get('CHAIN_ID');
    const permits = ESTIMATE_ACCOUNT_PERMITS[chainId];

    const permit = token === 'WSTETH' ? permits.wsteth_permit : permits.steth_permit;
    const method =
      token === 'WSTETH'
        ? this.contract.estimateGas.requestWithdrawalsWstETHWithPermit
        : this.contract.estimateGas.requestWithdrawalsWithPermit;

    const helperGasLimit =
      (token === 'STETH'
        ? WITHDRAWAL_QUEUE_REQUEST_STETH_PERMIT_GAS_LIMIT_DEFAULT
        : WITHDRAWAL_QUEUE_REQUEST_WSTETH_PERMIT_GAS_LIMIT_DEFAULT) *
      requestCount *
      10;

    if (isDisable) return { gasLimit: helperGasLimit };

    const gasLimit = await method(Array(Number(requestCount)).fill(BigNumber.from(100)), ESTIMATE_ACCOUNT, permit, {
      from: ESTIMATE_ACCOUNT,
      gasLimit: helperGasLimit,
    }).then((r) => r.toNumber());

    return { gasLimit };
  }
}

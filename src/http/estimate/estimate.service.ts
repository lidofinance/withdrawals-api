import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { parseEther } from 'ethers';

import { ConfigService } from 'common/config';

import { ESTIMATE_ACCOUNT, ESTIMATE_ACCOUNT_PERMITS } from './estimate.constants';
import { EstimateDto, EstimateOptionsDto } from './dto';

@Injectable()
export class EstimateService {
  constructor(
    protected readonly configService: ConfigService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contract: WithdrawalQueue,
  ) {}

  async getEstimate(params: EstimateOptionsDto): Promise<EstimateDto | null> {
    const { token, requestCount } = params;
    const chainId = this.configService.get('CHAIN_ID');
    const permits = ESTIMATE_ACCOUNT_PERMITS[chainId];

    const permit = token === 'WSTETH' ? permits.wsteth_permit : permits.steth_permit;
    const method =
      token === 'WSTETH'
        ? this.contract.estimateGas.requestWithdrawalsWstETHWithPermit
        : this.contract.estimateGas.requestWithdrawalsWithPermit;

    const gasLimit = await method(
      Array(Number(requestCount)).fill(parseEther('0.000000001')),
      ESTIMATE_ACCOUNT,
      permit,
      {
        from: ESTIMATE_ACCOUNT,
      },
    ).then((r) => r.toNumber());

    return { gasLimit };
  }
}

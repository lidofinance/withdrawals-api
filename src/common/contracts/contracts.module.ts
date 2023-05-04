import { CHAINS } from '@lido-nestjs/constants';
import { WithdrawalQueueContractModule } from '@lido-nestjs/contracts';
import { Global, Module } from '@nestjs/common';
import { ExecutionProvider } from 'common/execution-provider';

const WQ_ADDRESSES = {
  [CHAINS.Mainnet]: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
  [CHAINS.Goerli]: '0xCF117961421cA9e546cD7f50bC73abCdB3039533',
};

@Global()
@Module({
  imports: [
    WithdrawalQueueContractModule.forRootAsync({
      async useFactory(provider: ExecutionProvider) {
        const network = await provider.getNetwork();
        return { provider, address: WQ_ADDRESSES[network.chainId] };
      },
      inject: [ExecutionProvider],
    }),
  ],
})
export class ContractsModule {}

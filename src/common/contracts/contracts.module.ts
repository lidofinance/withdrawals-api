import {
  WithdrawalQueueContractModule,
  LidoContractModule,
  OracleReportSanityCheckerModule,
  AccountingOracleHashConsensusModule,
  ValidatorsExitBusOracleHashConsensusModule,
  LidoLocatorContractModule,
} from '@lido-nestjs/contracts';
import { Global, Module } from '@nestjs/common';
import { ExecutionProvider } from 'common/execution-provider';
import { ConfigService } from '../config';

@Global()
@Module({
  imports: [
    WithdrawalQueueContractModule,
    LidoContractModule,
    OracleReportSanityCheckerModule,
    AccountingOracleHashConsensusModule,
    ValidatorsExitBusOracleHashConsensusModule,
    LidoLocatorContractModule,
  ].map((module) =>
    module.forRootAsync({
      async useFactory(provider: ExecutionProvider, config: ConfigService) {
        const addressMap = await config.getCustomConfigContractsAddressMap();
        const address = addressMap ? addressMap.get(module.contractToken) : undefined;
        return { provider, address };
      },
      inject: [ExecutionProvider, ConfigService],
    }),
  ),
})
export class ContractsModule {}

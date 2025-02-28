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
import { ConfigService } from 'common/config';

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
        const addressMap = config.getCustomConfigContractsAddressMap();
        return { provider, address: addressMap.get(module.contractToken) };
      },
      inject: [ExecutionProvider, ConfigService],
    }),
  ),
})
export class ContractsModule {}

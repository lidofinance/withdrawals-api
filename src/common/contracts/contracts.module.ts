import {
  WithdrawalQueueContractModule,
  LidoContractModule,
  OracleReportSanityCheckerModule,
  AccountingOracleHashConsensusModule,
} from '@lido-nestjs/contracts';
import { Global, Module } from '@nestjs/common';
import { ExecutionProvider } from 'common/execution-provider';

@Global()
@Module({
  imports: [
    WithdrawalQueueContractModule,
    LidoContractModule,
    OracleReportSanityCheckerModule,
    AccountingOracleHashConsensusModule,
  ].map((module) =>
    module.forRootAsync({
      async useFactory(provider: ExecutionProvider) {
        return { provider };
      },
      inject: [ExecutionProvider],
    }),
  ),
})
export class ContractsModule {}

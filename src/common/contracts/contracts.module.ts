import {
  WithdrawalQueueContractModule,
  LidoContractModule,
  OracleReportSanityCheckerModule,
  AccountingOracleHashConsensusModule,
  LidoLocatorContractModule,
} from '@lido-nestjs/contracts';
import { Global, Module } from '@nestjs/common';
import { ExecutionProvider } from 'common/execution-provider';
import { AccountingOracleModule } from './accounting-oracle/accounting-oracle.module';
import { BurnerModule } from './burner/burner.module';

@Global()
@Module({
  imports: [
    ...[
      WithdrawalQueueContractModule,
      LidoContractModule,
      OracleReportSanityCheckerModule,
      AccountingOracleHashConsensusModule,
      BurnerModule,
      AccountingOracleModule,
      LidoLocatorContractModule,
    ].map((module) =>
      module.forRootAsync({
        async useFactory(provider: ExecutionProvider) {
          return { provider };
        },
        inject: [ExecutionProvider],
      }),
    ),
  ],
})
export class ContractsModule {}

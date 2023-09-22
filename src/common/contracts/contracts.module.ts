import { WithdrawalQueueContractModule, LidoContractModule, LidoLocatorContractModule } from '@lido-nestjs/contracts';
import { Global, Module } from '@nestjs/common';
import { ExecutionProvider } from 'common/execution-provider';
import { HashConsensusModule } from './hash-consensus/hash-consensus.module';
import { OracleReportSanityCheckerModule } from './oracle-report-sanity-checker/oracle-report-sanity-checker.module';
import { AccountingOracleModule } from './accounting-oracle/accounting-oracle.module';
import { BurnerModule } from './burner/burner.module';

@Global()
@Module({
  imports: [
    WithdrawalQueueContractModule.forRootAsync({
      async useFactory(provider: ExecutionProvider) {
        return { provider };
      },
      inject: [ExecutionProvider],
    }),
    LidoContractModule.forRootAsync({
      async useFactory(provider: ExecutionProvider) {
        return { provider };
      },
      inject: [ExecutionProvider],
    }),
    OracleReportSanityCheckerModule.forRootAsync({
      async useFactory(provider: ExecutionProvider) {
        return { provider };
      },
      inject: [ExecutionProvider],
    }),
    HashConsensusModule.forRootAsync({
      async useFactory(provider: ExecutionProvider) {
        return { provider };
      },
      inject: [ExecutionProvider],
    }),
    AccountingOracleModule.forRootAsync({
      async useFactory(provider: ExecutionProvider) {
        return { provider };
      },
      inject: [ExecutionProvider],
    }),
    LidoLocatorContractModule.forRootAsync({
      async useFactory(provider: ExecutionProvider) {
        return { provider };
      },
      inject: [ExecutionProvider],
    }),
    BurnerModule.forRootAsync({
      async useFactory(provider: ExecutionProvider) {
        return { provider };
      },
      inject: [ExecutionProvider],
    }),
  ],
})
export class ContractsModule {}

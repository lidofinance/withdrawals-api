import { Module } from '@nestjs/common';
import { BunkerService } from './bunker.service';
import { QueueInfoStorageModule, ValidatorsStorageModule } from '../../../storage';
import { FallbackProviderModule } from '@lido-nestjs/execution';
import { ConfigService } from '../../../common/config';

@Module({
  imports: [
    ValidatorsStorageModule,
    QueueInfoStorageModule,
    FallbackProviderModule.forRootAsync({
      async useFactory(configService: ConfigService) {
        return {
          urls: configService.get('EL_RPC_URLS') as [string],
          network: configService.get('CHAIN_ID'),
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [BunkerService],
})
export class BunkerModule {}

import { Module } from '@nestjs/common';
import { ValidatorsStorageModule } from 'storage';
import { LidoKeysService } from './lido-keys.service';
import { LidoKeysClient } from './lido-keys.client';

@Module({
  imports: [ValidatorsStorageModule],
  providers: [LidoKeysService, LidoKeysClient],
  exports: [LidoKeysService],
})
export class LidoKeysModule {}

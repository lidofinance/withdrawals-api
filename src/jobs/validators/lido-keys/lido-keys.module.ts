import { Module } from '@nestjs/common';
import { ValidatorsStorageModule } from 'storage';
import { LidoKeysService } from './lido-keys.service';

@Module({
  imports: [ValidatorsStorageModule],
  providers: [LidoKeysService],
  exports: [LidoKeysService],
})
export class LidoKeysModule {}

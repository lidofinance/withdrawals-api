import { Module } from '@nestjs/common';
import { ValidatorsStorageService } from './validators.service';

@Module({
  providers: [ValidatorsStorageService],
  exports: [ValidatorsStorageService],
})
export class ValidatorsStorageModule {}

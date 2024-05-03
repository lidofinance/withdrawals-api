import { Module } from '@nestjs/common';
import { ValidatorsStorageService } from './validators.service';
import { ValidatorsCacheService } from './validators-cache.service';

@Module({
  providers: [ValidatorsStorageService, ValidatorsCacheService],
  exports: [ValidatorsStorageService, ValidatorsCacheService],
})
export class ValidatorsStorageModule {}

import { Module } from '@nestjs/common';
import { JobModule } from 'common/job';
import { ValidatorsStorageModule } from 'storage';
import { ValidatorsService } from './validators.service';

@Module({
  imports: [JobModule, ValidatorsStorageModule],
  providers: [ValidatorsService],
  exports: [ValidatorsService],
})
export class ValidatorsModule {}

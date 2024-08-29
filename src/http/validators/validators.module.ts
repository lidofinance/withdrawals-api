import { Module } from '@nestjs/common';
import { ConfigModule } from 'common/config';
import { ValidatorsController } from './validators.controller';
import { ValidatorsService } from './validators.service';
import { ValidatorsStorageModule } from '../../storage';

@Module({
  imports: [ConfigModule, ValidatorsStorageModule],
  controllers: [ValidatorsController],
  providers: [ValidatorsService],
})
export class ValidatorsModule {}

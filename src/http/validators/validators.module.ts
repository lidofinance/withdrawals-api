import { Module } from '@nestjs/common';
import { ConfigModule } from 'common/config';
import { ValidatorsController } from './validators.controller';
import { ValidatorsService } from './validators.service';
import { ValidatorsStorageModule } from '../../storage';
import { GenesisTimeModule } from '../../common/genesis-time';

@Module({
  imports: [ConfigModule, ValidatorsStorageModule, GenesisTimeModule],
  controllers: [ValidatorsController],
  providers: [ValidatorsService],
})
export class ValidatorsModule {}

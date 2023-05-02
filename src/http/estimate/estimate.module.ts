import { Module } from '@nestjs/common';
import { ConfigModule } from 'common/config';
import { EstimateController } from './estimate.controller';
import { EstimateService } from './estimate.service';

@Module({
  imports: [ConfigModule],
  controllers: [EstimateController],
  providers: [EstimateService],
})
export class EstimateModule {}

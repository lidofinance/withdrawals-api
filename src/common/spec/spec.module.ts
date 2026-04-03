import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'common/logger';
import { SpecJobService } from './spec.job';
import { SpecService } from './spec.service';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [SpecService, SpecJobService],
  exports: [SpecService],
})
export class SpecModule {}

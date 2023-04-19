import { Module } from '@nestjs/common';
import { ConfigModule } from 'common/config';
import { QueueInfoStorageModule } from 'storage';
import { NFTController } from './nft.controller';
import { NFTService } from './nft.service';

@Module({
  imports: [ConfigModule, QueueInfoStorageModule],
  controllers: [NFTController],
  providers: [NFTService],
})
export class NFTModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from 'common/config';
import { NFTController } from './nft.controller';
import { NFTService } from './nft.service';

@Module({
  imports: [ConfigModule],
  controllers: [NFTController],
  providers: [NFTService],
})
export class NFTModule {}

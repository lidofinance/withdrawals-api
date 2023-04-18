import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  UseInterceptors,
  Version,
  CacheTTL,
  Param,
  Query,
  Header,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CacheControlHeaders } from 'http/common/cache';
import { NFTService } from './nft.service';
import { NFTDto, NFTParamsDto, NFTOptionsDto } from './dto';

@Controller('nft')
@ApiTags('NFT')
@UseInterceptors(ClassSerializerInterceptor)
export class NFTController {
  constructor(protected readonly nftService: NFTService) {}

  @Version('1')
  @Get('/:tokenId')
  @Throttle(10, 30)
  @CacheTTL(10)
  @CacheControlHeaders({ maxAge: 10 })
  @ApiResponse({ status: HttpStatus.OK, type: NFTDto })
  async nftMetaV1(@Param() nftParams: NFTParamsDto, @Query() nftQuery: NFTOptionsDto): Promise<NFTDto> {
    return await this.nftService.getNftMeta(nftParams, nftQuery);
  }

  @Version('1')
  @Get('/:tokenId/image')
  @Throttle(10, 30)
  @CacheTTL(10)
  @CacheControlHeaders({ maxAge: 10 })
  @ApiResponse({ status: HttpStatus.OK, type: NFTDto })
  @Header('Content-Type', 'image/svg+xml')
  async nftImageV1(@Param() nftParams: NFTParamsDto, @Query() nftQuery: NFTOptionsDto): Promise<string> {
    return this.nftService.getNftImage(nftParams, nftQuery);
  }
}

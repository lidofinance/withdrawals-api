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
import { HTTP_PATHS } from 'http/http.constants';
import { NFTService } from './nft.service';
import { NFTDto, NFTParamsDto, NFTOptionsDto } from './dto';

@Controller(HTTP_PATHS[1].nft)
@ApiTags('NFT')
@UseInterceptors(ClassSerializerInterceptor)
export class NFTController {
  constructor(protected readonly nftService: NFTService) {}

  @Version('1')
  @Get('/:tokenId')
  @Throttle({ default: { limit: 2000, ttl: 30000 } })
  @CacheTTL(20 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: NFTDto })
  async nftMetaV1(@Param() nftParams: NFTParamsDto, @Query() nftQuery: NFTOptionsDto): Promise<NFTDto> {
    return await this.nftService.getNftMeta(nftParams, nftQuery);
  }

  @Version('1')
  @Get('/:tokenId/image')
  // limit: 10, ttl: 30
  @Throttle({ default: { limit: 10, ttl: 30000 } })
  @CacheTTL(20 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: NFTDto })
  @Header('Content-Type', 'image/svg+xml')
  async nftImageV1(@Param() nftParams: NFTParamsDto, @Query() nftQuery: NFTOptionsDto): Promise<string> {
    return this.nftService.getNftImage(nftParams, nftQuery);
  }
}

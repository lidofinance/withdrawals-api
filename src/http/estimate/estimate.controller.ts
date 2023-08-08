import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  UseInterceptors,
  Version,
  CacheTTL,
  Query,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HTTP_PATHS } from 'http/http.constants';

import { EstimateService } from './estimate.service';
import { EstimateDto, EstimateOptionsDto } from './dto';

@Controller(HTTP_PATHS[1]['estimate-gas'])
@ApiTags('Estimate')
@UseInterceptors(ClassSerializerInterceptor)
export class EstimateController {
  constructor(protected readonly estimateService: EstimateService) {}

  @Version('1')
  @Get('/')
  @Throttle(30, 30)
  @CacheTTL(3600 * 1000) // 1 hour
  @ApiResponse({ status: HttpStatus.OK, type: EstimateDto })
  async requestTimeV1(@Query() estimateOptions: EstimateOptionsDto): Promise<EstimateDto | null> {
    return await this.estimateService.getEstimate(estimateOptions);
  }
}

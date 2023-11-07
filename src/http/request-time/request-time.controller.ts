import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  UseInterceptors,
  Version,
  Query,
  Param,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HTTP_PATHS } from 'http/http.constants';

import { RequestTimeService } from './request-time.service';
import { RequestTimeDto, RequestTimeOptionsDto } from './dto';
import { RequestTimeV2Dto } from './dto/request-time-v2.dto';
import { RequestTimeByRequestIdDto } from './dto/request-time-by-request-id.dto';
import { RequestsOptionsDto } from './dto/requests-options.dto';

@Controller()
@ApiTags('Request Time')
@UseInterceptors(ClassSerializerInterceptor)
export class RequestTimeController {
  constructor(protected readonly requestTimeService: RequestTimeService) {}

  @Version('1')
  @Get(HTTP_PATHS[1]['request-time'])
  @Throttle(30, 30)
  @CacheTTL(10 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: RequestTimeDto })
  async requestTimeV1(@Query() requestTimeOptions: RequestTimeOptionsDto): Promise<RequestTimeDto | null> {
    return await this.requestTimeService.getRequestTime(requestTimeOptions);
  }

  @Version('2')
  @Get(HTTP_PATHS[1]['request-time'])
  @Throttle(30, 30)
  @CacheTTL(10 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: RequestTimeV2Dto })
  async requestTimeV2(@Query() requestTimeOptions: RequestTimeOptionsDto): Promise<RequestTimeV2Dto | null> {
    return await this.requestTimeService.getRequestTimeV2(requestTimeOptions);
  }

  @Version('1')
  @Get(HTTP_PATHS[1]['requests'] + '/:requestId')
  @Throttle(30, 30)
  @CacheTTL(10 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: RequestTimeByRequestIdDto })
  async getTimeByRequestId(@Param('requestId') requestId: string): Promise<RequestTimeByRequestIdDto | null> {
    return await this.requestTimeService.getTimeByRequestId(requestId);
  }

  @Version('1')
  @Get(HTTP_PATHS[1]['requests'])
  @Throttle(30, 30)
  @CacheTTL(10 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: Array<RequestTimeByRequestIdDto> })
  async requests(@Query() requestsOptions: RequestsOptionsDto) {
    return await this.requestTimeService.getRequests(requestsOptions);
  }
}

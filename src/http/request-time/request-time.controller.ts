import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  UseInterceptors,
  Version,
  Query,
  Headers,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HTTP_PATHS } from 'http/http.constants';

import { RequestTimeService } from './request-time.service';
import { RequestTimeDto, RequestTimeOptionsDto } from './dto';
import { RequestTimeV2Dto } from './dto/request-time-v2.dto';
import { RequestTimeByRequestIdDto } from './dto/request-time-by-request-id.dto';
import { RequestsTimeOptionsDto } from './dto/requests-time-options.dto';
import { ErrorResponseType } from '../common/dto/error-response-type';
import { PrometheusService } from '../../common/prometheus';
import { RequestSourceType, REQUEST_SOURCE_HEADER } from './headers/request-source-type';

@Controller(HTTP_PATHS[1]['request-time'])
@ApiTags('Request Time')
@UseInterceptors(ClassSerializerInterceptor)
export class RequestTimeController {
  constructor(
    protected readonly requestTimeService: RequestTimeService,
    protected readonly prometheusService: PrometheusService,
  ) {}

  @Version('1')
  @Get()
  @Throttle(30, 30)
  @CacheTTL(10 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: RequestTimeDto })
  @ApiHeader({
    name: REQUEST_SOURCE_HEADER,
    example: 'widget',
    description: 'Sources of withdrawal time requests',
    required: false,
    enum: RequestSourceType,
  })
  async requestTimeV1(
    @Query() requestTimeOptions: RequestTimeOptionsDto,
    @Headers(REQUEST_SOURCE_HEADER) source: RequestSourceType,
  ): Promise<RequestTimeDto | null> {
    this.prometheusService.trackRequestSource(source, 'v1/request-time');
    return await this.requestTimeService.getRequestTime(requestTimeOptions);
  }

  @Version('2')
  @Get()
  @Throttle(30, 30)
  @CacheTTL(10 * 1000)
  @ApiResponse({ status: HttpStatus.OK, isArray: true, type: RequestTimeByRequestIdDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'ids should be array of string id withdrawal requests',
    type: ErrorResponseType,
  })
  @ApiHeader({
    name: REQUEST_SOURCE_HEADER,
    example: 'widget',
    description: 'Sources of withdrawal time requests',
    required: false,
    enum: RequestSourceType,
  })
  async requestsTime(
    @Query() requestsOptions: RequestsTimeOptionsDto,
    @Headers(REQUEST_SOURCE_HEADER) source: RequestSourceType,
  ) {
    this.prometheusService.trackRequestSource(source, 'v2/request-time');
    return await this.requestTimeService.getTimeRequests(requestsOptions);
  }

  @Version('2')
  @Get('/calculate')
  @Throttle(30, 30)
  @CacheTTL(10 * 1000)
  @ApiResponse({
    status: HttpStatus.OK,
    type: RequestTimeV2Dto,
    description: 'Calculates time to withdrawal amount of stEth',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Amount should be valid eth value or amount should not be',
    type: ErrorResponseType,
  })
  @ApiHeader({
    name: REQUEST_SOURCE_HEADER,
    example: 'widget',
    description: 'Sources of withdrawal time requests',
    required: false,
    enum: RequestSourceType,
  })
  async calculateTime(
    @Query() requestTimeOptions: RequestTimeOptionsDto,
    @Headers(REQUEST_SOURCE_HEADER) source: RequestSourceType,
  ) {
    this.prometheusService.trackRequestSource(source, 'v2/request-time/calculate');
    return await this.requestTimeService.getRequestTimeV2({ amount: requestTimeOptions.amount });
  }
}

import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  UseInterceptors,
  Version,
  Query,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HTTP_PATHS } from 'http/http.constants';

import { RequestTimeService } from './request-time.service';
import { RequestTimeDto, RequestTimeOptionsDto } from './dto';
import { RequestTimeV2Dto } from './dto/request-time-v2.dto';

@Controller(HTTP_PATHS[1]['request-time'])
@ApiTags('Request Time')
@UseInterceptors(ClassSerializerInterceptor)
export class RequestTimeController {
  constructor(protected readonly requestTimeService: RequestTimeService) {}

  @Version('1')
  @Get('/')
  @Throttle(30, 30)
  @CacheTTL(10 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: RequestTimeDto })
  async requestTimeV1(@Query() requestTimeOptions: RequestTimeOptionsDto): Promise<RequestTimeDto | null> {
    return await this.requestTimeService.getRequestTime(requestTimeOptions);
  }

  @Version('2')
  @Get('/')
  @Throttle(30, 30)
  @CacheTTL(10 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: RequestTimeV2Dto })
  async requestTimeV2(@Query() requestTimeOptions: RequestTimeOptionsDto): Promise<RequestTimeV2Dto | null> {
    return await this.requestTimeService.getRequestTimeV2(requestTimeOptions);
  }
}

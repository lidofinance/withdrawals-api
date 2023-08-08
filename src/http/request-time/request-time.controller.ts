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

@Controller(HTTP_PATHS[1]['request-time'])
@ApiTags('Request Time')
@UseInterceptors(ClassSerializerInterceptor)
export class RequestTimeController {
  constructor(protected readonly requestTimeService: RequestTimeService) {}

  @Version('1')
  @Get('/')
  @Throttle(30, 30)
  @CacheTTL(10000)
  @ApiResponse({ status: HttpStatus.OK, type: RequestTimeDto })
  async requestTimeV1(@Query() requestTimeOptions: RequestTimeOptionsDto): Promise<RequestTimeDto | null> {
    return await this.requestTimeService.getRequestTime(requestTimeOptions);
  }
}

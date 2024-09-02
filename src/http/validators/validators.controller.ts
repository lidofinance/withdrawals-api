import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  UseInterceptors,
  Version,
  CacheTTL,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { HTTP_PATHS } from 'http/http.constants';
import { ValidatorsService } from './validators.service';
import { ValidatorsDto } from './dto';

@Controller()
@ApiTags('Validators')
@UseInterceptors(ClassSerializerInterceptor)
export class ValidatorsController {
  constructor(protected readonly validatorsService: ValidatorsService) {}

  @Version('1')
  @Get(HTTP_PATHS[1]['validators-info'])
  @CacheTTL(20 * 1000)
  @ApiResponse({ status: HttpStatus.OK, type: ValidatorsDto })
  async validatorsV1(): Promise<ValidatorsDto> {
    return this.validatorsService.getValidatorsInfo();
  }
}

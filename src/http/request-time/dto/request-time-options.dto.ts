import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { MAX_VALID_NUMBER } from '../request-time.constants';

export class RequestTimeOptionsDto {
  @ApiPropertyOptional({ type: 'number', minimum: 0, description: 'stETH amount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MAX_VALID_NUMBER)
  @IsOptional()
  readonly amount?: number;
}

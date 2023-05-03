import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class RequestTimeOptionsDto {
  @ApiPropertyOptional({ type: 'number', minimum: 0, description: 'stETH amount' })
  @Type(() => BigInt)
  @IsOptional()
  readonly amount?: string;
}

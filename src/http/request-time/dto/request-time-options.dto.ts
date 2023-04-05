import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class RequestTimeOptionsDto {
  @ApiPropertyOptional({ type: 'bigint', minimum: 0, description: 'stETH amount' })
  @Type(() => BigInt)
  @IsInt()
  @Min(0)
  @IsOptional()
  readonly amount?: string;
}

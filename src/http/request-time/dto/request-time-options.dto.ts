import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class RequestTimeOptionsDto {
  @ApiPropertyOptional({ type: 'int', minimum: 0, description: 'stETH amount' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  readonly amount?: number;
}

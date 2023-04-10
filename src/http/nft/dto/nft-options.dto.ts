import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ToLowerCase } from 'common/transforms';

export class NFTOptionsDto {
  @ApiPropertyOptional({ type: 'string', example: 'pending', description: 'Requests finalize status' })
  @ToLowerCase()
  @IsOptional()
  readonly status: 'finalized' | 'pending';

  @ApiPropertyOptional({ type: 'bigint', minimum: 0, example: '25000000000000000000', description: 'Token amount' })
  @Type(() => BigInt)
  @IsInt()
  @Min(0)
  @IsOptional()
  readonly amount: string;

  @ApiPropertyOptional({ type: 'timestamp', example: 1658650005, minimum: 0, description: 'Created timestamp' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  readonly created_at: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ToLowerCase } from 'common/transforms';

export class NFTOptionsDto {
  @ApiPropertyOptional({
    type: 'bigint',
    minimum: 0,
    example: '25000000000000000000',
    description: 'Requested token amount',
  })
  @ToLowerCase()
  readonly requested: 'finalized' | 'pending';

  @ApiPropertyOptional({ type: 'timestamp', example: 1658650005, minimum: 0, description: 'Created timestamp' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly created_at: number;

  @ApiPropertyOptional({
    type: 'bigint',
    minimum: 0,
    example: '25000000000000000000',
    description: 'Claimable token amount',
  })
  @Type(() => BigInt)
  @IsInt()
  @Min(0)
  @IsOptional()
  readonly finalized?: string;
}

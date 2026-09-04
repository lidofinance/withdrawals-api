import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class NFTOptionsDto {
  @ApiProperty({
    type: 'string',
    pattern: '^\\d+$', // minimum is 0,
    example: '25000000000000000000',
    description: 'Requested token amount as BigInt',
    required: true,
  })
  @IsNotEmpty()
  readonly requested: string;

  @ApiProperty({
    type: 'number',
    example: 1658650005,
    minimum: 0,
    description: 'Created timestamp',
    required: true,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  readonly created_at: number;

  @ApiPropertyOptional({
    type: 'string',
    minimum: 0,
    example: '25000000000000000000',
    description: 'Claimable token amount as BigInt',
  })
  @IsOptional()
  readonly finalized?: string;
}

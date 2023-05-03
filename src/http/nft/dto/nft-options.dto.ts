import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class NFTOptionsDto {
  @ApiProperty({
    type: 'string',
    minimum: 0,
    example: '25000000000000000000',
    description: 'Requested token amount',
    required: true,
  })
  @IsNotEmpty()
  @Type(() => BigInt)
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
    type: 'bigint',
    minimum: 0,
    example: '25000000000000000000',
    description: 'Claimable token amount',
  })
  @Type(() => BigInt)
  @IsOptional()
  readonly finalized?: string;
}

export class NFTImageOptionsDto {
  @ApiProperty({
    type: 'string',
    example: '25000000000000000000',
    description: 'Requested token amount',
    required: true,
  })
  @Type(() => BigInt)
  @IsOptional()
  readonly requested?: string;

  @ApiProperty({
    type: 'number',
    example: 1658650005,
    description: 'Created timestamp',
    required: true,
  })
  @Type(() => Number)
  @IsOptional()
  readonly created_at?: number;

  @ApiPropertyOptional({
    type: 'bigint',
    minimum: 0,
    example: '25000000000000000000',
    description: 'Claimable token amount',
  })
  @Type(() => BigInt)
  @IsOptional()
  readonly finalized?: string;
}

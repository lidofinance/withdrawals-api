import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';
import { ToLowerCase } from 'common/transforms';

export class EstimateOptionsDto {
  @ApiProperty({
    type: 'string',
    description: 'Is token name',
    enum: ['STETH', 'WSTETH'],
    required: true,
  })
  @IsNotEmpty()
  @ToLowerCase()
  readonly token: string;

  @ApiProperty({ type: 'number', minimum: 1, description: 'Is request count', example: 1, required: true })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(256)
  @IsNotEmpty()
  readonly requestCount: number;
}

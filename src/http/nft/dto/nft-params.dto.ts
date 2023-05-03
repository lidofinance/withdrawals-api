import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class NFTParamsDto {
  @ApiProperty({ type: 'number', minimum: 0, description: 'NFT token id' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly tokenId: string;
}
export class NFTImageParamsDto {
  @ApiProperty({ type: 'number', description: 'NFT token id' })
  @Type(() => Number)
  @IsInt()
  readonly tokenId: string;
}

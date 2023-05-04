import { ApiProperty } from '@nestjs/swagger';

export class NFTDto {
  @ApiProperty({
    example: 'My NFT',
    description: 'NFT name',
  })
  name: string;

  @ApiProperty({
    example: 'This is my first NFT',
    description: 'NFT description',
  })
  description: string;

  @ApiProperty({
    example: 'data:image/png;base64',
    description: 'NFT image data',
  })
  image: string;
}

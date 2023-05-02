import { ApiProperty } from '@nestjs/swagger';

export class EstimateDto {
  @ApiProperty({
    example: 7777,
    description: 'Gas limit',
  })
  gasLimit: number;
}

import { ApiProperty } from '@nestjs/swagger';

export class RequestTimeV2Dto {
  @ApiProperty({
    example: 5,
    description: 'Maximum waiting ms',
  })
  finalizationIn: number;

  @ApiProperty({
    example: 0,
    description: 'Queue ETH last update timestamp',
  })
  stethLastUpdate: number;

  @ApiProperty({
    example: 0,
    description: 'Validators last update timestamp',
  })
  validatorsLastUpdate: number;

  @ApiProperty({
    example: 10,
    description: 'Queue requests count',
  })
  requests: number;

  @ApiProperty({
    example: '2023-10-04T15:14:24.202Z',
    description: 'Possible finalization At',
  })
  finalizationAt: string;

  @ApiProperty({
    example: 0,
    description: 'Queue steth amount',
  })
  steth: string;

  @ApiProperty({
    example: 'buffer',
    description: 'Case of calculation',
  })
  type: string;
}

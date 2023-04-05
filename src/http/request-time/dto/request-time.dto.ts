import { ApiProperty } from '@nestjs/swagger';

export class RequestTimeDto {
  @ApiProperty({
    example: 5,
    description: 'Maximum waiting days',
  })
  days: number;

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
    example: 0,
    description: 'Queue steth amount',
  })
  steth: string;
}

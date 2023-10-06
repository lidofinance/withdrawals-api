import { ApiProperty } from '@nestjs/swagger';

export class RequestTimeByRequestIdDto {
  @ApiProperty({
    example: 5,
    description: 'Maximum waiting ms',
  })
  ms: number;

  @ApiProperty({
    example: 5,
    description: 'Request Id',
  })
  requestId: string;

  @ApiProperty({
    example: '2023-10-04T15:14:24.202Z',
    description: 'Withdrawal At',
  })
  withdrawalAt: string;

  @ApiProperty({
    example: { ms: 0, withdrawalAt: '2023-10-04T15:14:24.202Z' },
    description: 'withdrawal info with Validator Exit Bus Oracle',
  })
  withVEBO: {
    ms: number;
    withdrawalAt: string;
  };
}

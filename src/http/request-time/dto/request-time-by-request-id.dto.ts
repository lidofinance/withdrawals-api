import { ApiProperty } from '@nestjs/swagger';

export enum RequestTimeStatus {
  initializing = 'initializing',
  calculating = 'calculating',
  finalized = 'finalized',
  calculated = 'calculated',
}

export class RequestInfoDto {
  @ApiProperty({
    example: 5,
    description: 'Maximum waiting ms',
  })
  finalizationIn: number;

  @ApiProperty({
    example: '2023-10-04T15:14:24.202Z',
    description: 'Possible withdrawal At',
  })
  finalizationAt: string;

  @ApiProperty({
    example: 5,
    description: 'Request Id',
  })
  requestId: string;

  @ApiProperty({
    example: '2023-10-03T15:14:24.202Z',
    description: 'Withdrawal requested at',
  })
  requestedAt: string;

  @ApiProperty({
    example: 'buffer',
    description: 'Case of calculation',
  })
  type: string;
}

export class RequestTimeByRequestIdDto {
  @ApiProperty()
  requestInfo: RequestInfoDto;

  @ApiProperty({
    type: 'string',
    description: 'status of request calculation',
    enum: Object.values(RequestTimeStatus),
  })
  status: RequestTimeStatus;

  @ApiProperty({
    type: 'string',
    description: 'next calculation time at',
    example: '2023-10-03T11:14:24.202Z',
  })
  nextCalculationAt: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { RequestTimeStatus } from './request-time-status';
import { RequestTimeCalculationType } from './request-time-calculation-type';

export class RequestByIdInfoDto {
  @ApiProperty({
    example: 5,
    description: 'Possible waiting ms',
  })
  finalizationIn: number;

  @ApiProperty({
    example: '2023-10-04T15:14:24.202Z',
    description: 'Possible finalization At',
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
    enum: Object.values(RequestTimeCalculationType),
  })
  type: RequestTimeCalculationType;
}

export class RequestTimeByRequestIdDto {
  @ApiProperty()
  requestInfo: RequestByIdInfoDto;

  @ApiProperty({
    type: 'string',
    description: 'Status of request calculation',
    enum: Object.values(RequestTimeStatus),
  })
  status: RequestTimeStatus;

  @ApiProperty({
    type: 'string',
    description: 'Next calculation time at',
    example: '2023-10-03T11:14:24.202Z',
  })
  nextCalculationAt: string;
}

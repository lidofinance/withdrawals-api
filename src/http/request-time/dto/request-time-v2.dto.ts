import { ApiProperty } from '@nestjs/swagger';

import { WaitingTimeStatus, WaitingTimeCalculationType } from 'waiting-time';

export class RequestInfoDto {
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
    example: 'buffer',
    description: 'Case of calculation',
    enum: Object.values(WaitingTimeCalculationType),
  })
  type: WaitingTimeCalculationType;
}

export class RequestTimeV2Dto {
  @ApiProperty()
  requestInfo: RequestInfoDto;

  @ApiProperty({
    type: 'string',
    description: 'Status of request calculation',
    enum: Object.values(WaitingTimeStatus),
  })
  status: WaitingTimeStatus;

  @ApiProperty({
    type: 'string',
    description: 'Next calculation time at',
    example: '2023-10-03T11:14:24.202Z',
  })
  nextCalculationAt: string;
}

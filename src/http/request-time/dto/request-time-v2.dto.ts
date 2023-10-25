import { ApiProperty } from '@nestjs/swagger';
import { RequestTimeStatus } from './request-time-status';

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
    example: 'buffer',
    description: 'Case of calculation',
  })
  type: string;
}

export class RequestTimeV2Dto {
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

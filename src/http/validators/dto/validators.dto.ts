import { ApiProperty } from '@nestjs/swagger';

export class ValidatorsDto {
  @ApiProperty({
    example: 1658650005,
    description: 'ms time when data was last updated at',
  })
  lastUpdatedAt: number;

  @ApiProperty({
    example: 1724856617,
    description: 'max exit epoch over all CL network',
  })
  maxExitEpoch: number;

  @ApiProperty({
    example: '{}',
    description: 'sum of balances Lido validators with withdrawable_epoch by frame',
  })
  frameBalances: Record<string, string>;

  @ApiProperty({
    example: 100000,
    description: 'total number of validators in network',
  })
  totalValidators: number;

  @ApiProperty({
    example: 100000,
    description: 'current frame',
  })
  currentFrame: number;
}

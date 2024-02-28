import { ApiPropertyOptional } from '@nestjs/swagger';
import { Validate } from 'class-validator';
import { IsEtherValidator } from 'common/validators/is-ether.validator';
import { MaxWithdrawableEtherValidator } from 'common/validators/max-withdrawable-ether.validator';
import { MinWithdrawableEtherValidator } from 'common/validators/min-withdrawable-ether.validator';

import { MAX_VALID_ETHER } from '../request-time.constants';

export class RequestTimeOptionsDto {
  @ApiPropertyOptional({ type: 'number', minimum: 0, description: 'stETH amount' })
  @Validate(MinWithdrawableEtherValidator)
  @Validate(MaxWithdrawableEtherValidator, [MAX_VALID_ETHER])
  @Validate(IsEtherValidator)
  readonly amount: string = '0';
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Validate, IsOptional } from 'class-validator';
import { IsEtherValidator } from 'common/validators/is-ether.validator';
import { MaxWithdrawableEtherValidator } from 'common/validators/max-withdrawable-ether.validator';
import { MinWithdrawableEtherValidator } from 'common/validators/min-withdrawable-ether.validator';

import { MAX_VALID_ETHER } from '../request-time.constants';
import { Optional } from '@nestjs/common';

export class RequestTimeOptionsDto {
  @ApiPropertyOptional({ type: 'number', minimum: 0, description: 'stETH amount' })
  @Validate(MinWithdrawableEtherValidator)
  @Validate(MaxWithdrawableEtherValidator, [MAX_VALID_ETHER])
  @Validate(IsEtherValidator)
  @IsOptional()
  readonly amount?: string;
}

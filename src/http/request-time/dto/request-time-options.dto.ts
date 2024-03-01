import { ApiPropertyOptional } from '@nestjs/swagger';
import { Validate, IsOptional } from 'class-validator';
import { IsEtherValidator } from 'common/validators/is-ether.validator';
import { MaxWithdrawableEtherValidator } from 'common/validators/max-withdrawable-ether.validator';
import { MinWithdrawableEtherValidator } from 'common/validators/min-withdrawable-ether.validator';
import { MAX_VALID_ETHER } from '../request-time.constants';

export class RequestTimeOptionsDto {
  @ApiPropertyOptional({ type: 'number', minimum: 0, description: 'stETH amount to withdrawal', example: '32' })
  @Validate(MinWithdrawableEtherValidator)
  @Validate(MaxWithdrawableEtherValidator, [MAX_VALID_ETHER])
  @Validate(IsEtherValidator)
  @IsOptional()
  readonly amount?: string;
}

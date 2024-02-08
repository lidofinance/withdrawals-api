import { ApiPropertyOptional } from '@nestjs/swagger';
import { Validate } from 'class-validator';
import { IsEtherValidator } from 'common/validators/is-ether.validator';
import { MaxEtherValidator } from 'common/validators/max-ether.validator';
import { MinEtherValidator } from 'common/validators/min-ether.validator';
import { MAX_VALID_NUMBER, MIN_VALID_NUMBER } from '../request-time.constants';

export class RequestTimeOptionsDto {
  @ApiPropertyOptional({ type: 'number', minimum: 0, description: 'stETH amount' })
  @Validate(MinEtherValidator, [MIN_VALID_NUMBER])
  @Validate(MaxEtherValidator, [MAX_VALID_NUMBER])
  @Validate(IsEtherValidator)
  readonly amount: string = '0';
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Validate } from 'class-validator';
import { IsEtherValidator } from 'common/validators/is-ether.validator';
import { MaxEtherValidator } from 'common/validators/max-ether.validator';
import { MinEtherValidator } from 'common/validators/min-ether.validator';

export class RequestTimeOptionsDto {
  @ApiPropertyOptional({ type: 'number', minimum: 0, description: 'stETH amount' })
  @Validate(MinEtherValidator)
  @Validate(MaxEtherValidator)
  @Validate(IsEtherValidator)
  readonly amount: string = '0';
}

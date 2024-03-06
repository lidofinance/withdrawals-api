import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { formatEther, parseEther } from '@ethersproject/units';
import { Injectable } from '@nestjs/common';
import { QueueInfoStorageService } from '../../storage';

@ValidatorConstraint({ name: 'minWithdrawableEtherValidator', async: false })
@Injectable()
export class MinWithdrawableEtherValidator implements ValidatorConstraintInterface {
  constructor(protected readonly queueInfo: QueueInfoStorageService) {}

  validate(value: string) {
    const min = this.queueInfo.getMinStethAmount();
    try {
      return parseEther(value).gte(min);
    } catch (e) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const min = this.queueInfo.getMinStethAmount();
    if (min === undefined) return 'Error while calculating min stETH amount. Please try again later.';

    return `${args.property} must not be less than ${formatEther(min || '0')}`;
  }
}

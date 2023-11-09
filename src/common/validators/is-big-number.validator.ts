import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { BigNumber } from '@ethersproject/bignumber';

@ValidatorConstraint({ name: 'isBigNumber', async: false })
export class IsBigNumberValidator implements ValidatorConstraintInterface {
  validate(value: string) {
    try {
      BigNumber.from(value);
    } catch (e) {
      return false;
    }
    return true;
  }

  defaultMessage() {
    return 'Value should be BigNumber.';
  }
}

import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { parseEther, formatEther } from '@ethersproject/units';

@ValidatorConstraint({ name: 'maxEther', async: false })
export class MaxEtherValidator implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    try {
      return parseEther(value).lte(args.constraints[0]);
    } catch (e) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must not be greater than ${formatEther(args.constraints[0])}`;
  }
}

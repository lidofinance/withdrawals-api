import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { parseEther } from '@ethersproject/units';

@ValidatorConstraint({ name: 'maxEther', async: false })
export class MaxEtherValidator implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    return parseEther(value).lt(parseEther(args.constraints[0]));
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must not be greater than ${args.constraints[0]}`;
  }
}

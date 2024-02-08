import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { parseEther } from '@ethersproject/units';

@ValidatorConstraint({ name: 'minEther', async: false })
export class MinEtherValidator implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    return parseEther(value).gte(parseEther(args.constraints[0]));
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must not be less than ${args.constraints[0]}`;
  }
}

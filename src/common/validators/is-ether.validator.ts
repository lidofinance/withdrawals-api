import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { parseEther } from '@ethersproject/units';

@ValidatorConstraint({ name: 'isEther', async: false })
export class IsEtherValidator implements ValidatorConstraintInterface {
  validate(value: string) {
    try {
      parseEther(value);
    } catch (e) {
      return false;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} should be a valid Ether amount`;
  }
}

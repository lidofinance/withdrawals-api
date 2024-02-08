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

  defaultMessage(validationArguments: ValidationArguments) {
    return `${validationArguments.property} should be Eth`;
  }
}

import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { MIN_VALID_NUMBER } from '../../http/request-time/request-time.constants';

@ValidatorConstraint({ name: 'minEther', async: false })
export class MinEtherValidator implements ValidatorConstraintInterface {
  validate(value: string) {
    return Number(value) >= MIN_VALID_NUMBER;
  }

  defaultMessage(validationArguments: ValidationArguments) {
    return `${validationArguments.property} must not be less than ${MIN_VALID_NUMBER}`;
  }
}

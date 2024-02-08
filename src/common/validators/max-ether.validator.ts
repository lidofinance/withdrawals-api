import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { MAX_VALID_NUMBER } from '../../http/request-time/request-time.constants';

@ValidatorConstraint({ name: 'maxEther', async: false })
export class MaxEtherValidator implements ValidatorConstraintInterface {
  validate(value: string) {
    return Number(value) < MAX_VALID_NUMBER;
  }

  defaultMessage(validationArguments: ValidationArguments) {
    return `${validationArguments.property} must not be greater than ${MAX_VALID_NUMBER}`;
  }
}

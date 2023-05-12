import { MAX_VALID_NUMBER } from './request-time.constants';

export const maxMinNumberValidation = (amount: string, min: string): { isValid: boolean; message?: string } => {
  const numberAmount = Number(amount);
  if (Number.isNaN(numberAmount)) return { isValid: false, message: 'Amount is not valid' };
  if (!Number.isFinite(numberAmount)) return { isValid: false, message: 'Amount is not valid' };
  if (numberAmount > MAX_VALID_NUMBER) return { isValid: false, message: 'Amount is too big' };
  if (numberAmount < Number(min)) return { isValid: false, message: 'Amount is too small' };

  return { isValid: true };
};

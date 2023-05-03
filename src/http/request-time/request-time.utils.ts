import { MAX_VALID_NUMBER } from './request-time.constants';

export const maxMinNumberValidation = (amount: string, min: string): { isValid: boolean; message?: string } => {
  if (Number.isNaN(Number(amount))) return { isValid: false, message: 'Amount is not valid' };
  if (Number.isFinite(amount)) return { isValid: false, message: 'Amount is not valid' };
  if (Number(amount) > MAX_VALID_NUMBER) return { isValid: false, message: 'Amount is too big' };
  if (Number(amount) < Number(min)) return { isValid: false, message: 'Amount is too small' };

  return { isValid: true };
};

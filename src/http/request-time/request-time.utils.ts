import { MAX_VALID_NUMBER } from './request-time.constants';

export const maxMinNumberValidation = (amount: number, min: string) => {
  if (Number.isNaN(Number(amount))) return '0';
  if (!Number.isFinite(amount)) return '0';
  if (Math.abs(Number(amount)) > MAX_VALID_NUMBER) return String(MAX_VALID_NUMBER);
  if (Math.abs(Number(amount)) < Number(min)) return min;

  return String(amount);
};

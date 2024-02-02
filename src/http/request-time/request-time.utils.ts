// todo: rework to dto validator as decorator (same as is-big-number.validator.ts)
export const minNumberValidation = (amount: string, min: string): { isValid: boolean; message?: string } => {
  const numberAmount = Number(amount);
  if (Number.isNaN(numberAmount)) return { isValid: false, message: 'Amount is not valid' };
  if (!Number.isFinite(numberAmount)) return { isValid: false, message: 'Amount is not valid' };
  if (numberAmount < Number(min)) return { isValid: false, message: 'Amount is too small' };

  return { isValid: true };
};

export const validateTimeResponseWithFallback = (ms: number) => {
  if (ms < 0) {
    console.error('Error: withdrawal time calculation less 0 days');
    return 5 * 3600 * 24 * 1000;
  }

  return ms;
};

import { LoggerService } from '@nestjs/common';

export const validateTimeResponseWithFallback = (ms: number, logger: Pick<LoggerService, 'error'>) => {
  if (ms < 0) {
    logger.error('Error: withdrawal time calculation less 0 days');
    return 5 * 3600 * 24 * 1000;
  }

  return ms;
};

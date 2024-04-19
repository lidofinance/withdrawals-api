import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { Log, Filter } from '@ethersproject/abstract-provider';
import { LoggerService } from '@lido-nestjs/logger';

const DEFAULT_RETRY_COUNT = 5;

// Retry needs for the case when the logs are not available in the RPC response, but they are expected to be there.
export const getLogsByRetryCount = async (
  provider: SimpleFallbackJsonRpcBatchProvider,
  filter: Filter,
  logger: LoggerService,
  eventName: string,
  retryCount = DEFAULT_RETRY_COUNT,
): Promise<Log[]> => {
  let logs = await provider.getLogs(filter);

  while (logs.length === 0 && retryCount > 0) {
    logger.warn(`${eventName}: No logs found. Retrying in 200 ms...`, { service: 'rewards' });

    await new Promise((resolve) => setTimeout(resolve, 200));
    logs = await provider.getLogs(filter);
    retryCount -= 1;
  }

  return logs;
};

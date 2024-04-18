import { SimpleFallbackJsonRpcBatchProvider } from '@lido-nestjs/execution';
import { Log, Filter } from '@ethersproject/abstract-provider';

export const getLogsWithOneRetry = async (
  provider: SimpleFallbackJsonRpcBatchProvider,
  filter: Filter,
): Promise<Log[]> => {
  let logs = await provider.getLogs(filter);

  if (logs.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    logs = await provider.getLogs(filter);
  }
  return logs;
};

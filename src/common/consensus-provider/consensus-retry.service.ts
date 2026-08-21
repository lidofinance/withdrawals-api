import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from '@lido-nestjs/logger';
import { ConfigService } from 'common/config/config.service';
import { PrometheusService } from 'common/prometheus/prometheus.service';
import { sanitizeError } from 'common/errors';

@Injectable()
export class ConsensusRetryService {
  constructor(
    protected readonly configService: ConfigService,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly prometheusService: PrometheusService,
  ) {}

  public async execute<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const maxAttempts = this.configService.get('CL_STREAM_RETRY_ATTEMPTS');
    const retryDelayMs = this.configService.get('CL_STREAM_RETRY_DELAY_MS');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt >= maxAttempts) {
          this.prometheusService.clApiRetryExhaustedTotal.labels({ operation }).inc();
          throw error;
        }

        this.prometheusService.clApiRetriesTotal.labels({ operation }).inc();
        this.logger.warn('Consensus stream operation failed, retrying', {
          service: 'consensus',
          operation,
          attempt,
          nextAttempt: attempt + 1,
          maxAttempts,
          retryDelayMs,
          error: sanitizeError(error),
        });

        await this.delay(retryDelayMs);
      }
    }

    throw new Error(`Consensus retry loop unexpectedly completed for ${operation}`);
  }

  protected async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

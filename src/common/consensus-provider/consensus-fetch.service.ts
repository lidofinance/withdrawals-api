import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from '@lido-nestjs/logger';
import { FetchModuleOptions, FetchService, RequestInfo } from '@lido-nestjs/fetch';
import { MiddlewareService } from '@lido-nestjs/middleware';
import { AbortController } from 'node-abort-controller';
import { RequestInit, Response } from 'node-fetch';
import { AbortSignal } from 'node-fetch/externals'; // add this line
import { CONSENSUS_REQUEST_TIMEOUT } from './consensus-provider.constants';

@Injectable()
export class ConsensusFetchService extends FetchService {
  constructor(
    options: FetchModuleOptions,
    middlewareService: MiddlewareService<Promise<Response>>,
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
  ) {
    super(options, middlewareService);
  }

  /**
   * Adds timeout to the source method of fetch service
   */
  protected async request(url: RequestInfo, init?: RequestInit, attempt = 0) {
    const controller = new AbortController();
    const { signal } = controller;

    setTimeout(() => {
      controller.abort();
    }, CONSENSUS_REQUEST_TIMEOUT);

    const result = await super.request(
      url,
      {
        ...init,
        signal: signal as AbortSignal,
      },
      attempt,
    );

    const responseHeaders = Object.fromEntries(result.headers.entries());

    this.logger.debug('Consensus request trace', {
      requestUrl: String(url),
      requestHeaders: init?.headers ?? {},
      responseUrl: result.url, // safe here (logger removes secret api key)
      responseStatus: result.status,
      responseHeaders,
    });

    result.body.once('error', (error) => {
      this.logger.warn('Consensus response stream error', {
        requestUrl: String(url),
        responseUrl: result.url, // safe here (logger removes secret api key)
        responseStatus: result.status,
        responseHeaders,
        error,
      });
    });

    result.body.once('end', () => {
      this.logger.debug('Consensus response stream completed', {
        requestUrl: String(url),
        responseUrl: result.url, // safe here (logger removes secret api key)
        responseStatus: result.status,
        responseHeaders,
      });
    });

    return result;
  }
}

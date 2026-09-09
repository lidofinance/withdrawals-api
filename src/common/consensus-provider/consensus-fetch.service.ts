import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, LoggerService } from '@lido-nestjs/logger';
import { FetchModuleOptions, FetchService, RequestInfo } from '@lido-nestjs/fetch';
import { MiddlewareService } from '@lido-nestjs/middleware';
import { AbortController } from 'node-abort-controller';
import { Headers, RequestInit, Response } from 'node-fetch';
import { AbortSignal } from 'node-fetch/externals'; // add this line
import { APP_USER_AGENT } from 'app/app.constants';
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

    const headers = new Headers(init?.headers);
    headers.set('User-Agent', APP_USER_AGENT);

    const result = await super.request(
      url,
      {
        ...init,
        headers,
        signal: signal as AbortSignal,
      },
      attempt,
    );

    const responseHeaders = Object.fromEntries(result.headers.entries());

    this.logger.debug('Consensus request trace', {
      requestUrl: String(url),
      requestHeaders: Object.fromEntries(headers.entries()),
      responseUrl: result.url, // safe here (logger removes secret api key)
      responseStatus: result.status,
      responseHeaders,
    });

    result.body.once('error', (error) => {
      this.logger.error('Consensus response stream error', {
        requestUrl: String(url),
        requestHeaders: Object.fromEntries(headers.entries()),
        responseUrl: result.url, // safe here (logger removes secret api key)
        responseStatus: result.status,
        responseHeaders,
        error,
      });
    });

    result.body.once('end', () => {
      this.logger.debug('Consensus response stream completed', {
        requestUrl: String(url),
        requestHeaders: Object.fromEntries(headers.entries()),
        responseUrl: result.url, // safe here (logger removes secret api key)
        responseStatus: result.status,
        responseHeaders,
      });
    });

    return result;
  }
}

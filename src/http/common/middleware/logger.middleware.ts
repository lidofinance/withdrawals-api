import { Inject, Injectable, LoggerService, NestMiddleware } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Request, Reply } from './interfaces';
import { FastifyRequest } from 'fastify';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  use(request: any, reply: Reply, next: () => void) {
    const { ip, method, headers, originalUrl } = request;
    const userAgent = headers['user-agent'] ?? '';

    const ips = request.ips ? request.ips : [];

    reply.on('finish', () => {
      const { statusCode } = reply;
      const log = { method, originalUrl, statusCode, userAgent, ip, ips };

      this.logger.log(JSON.stringify(log));
    });

    next();
  }
}

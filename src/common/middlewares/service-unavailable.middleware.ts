import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

const excludedRoutes = ['/api', '/health', '/metrics'];

export const setupServiceUnavailableMiddleware = (app: NestFastifyApplication, configService: ConfigService) => {
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (req: FastifyRequest, res: FastifyReply) => {
      if (excludedRoutes.some((route) => req.url.startsWith(route))) {
        return;
      }
      const isMaintenance = configService.get('IS_SERVICE_UNAVAILABLE');

      if (isMaintenance) {
        res.code(HttpStatus.SERVICE_UNAVAILABLE).send({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Service is temporarily unavailable. Please try again later.',
        });
      }
    });
};

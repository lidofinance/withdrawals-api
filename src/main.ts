import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { SWAGGER_URL } from 'http/common/swagger';
import { ConfigService } from 'common/config';
import { AppModule, APP_DESCRIPTION, APP_NAME, APP_VERSION } from 'app';
import { satanizer, commonPatterns } from '@lidofinance/satanizer';
import { useContainer } from 'class-validator';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: true }), {
    bufferLogs: true,
  });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // config
  const configService: ConfigService = app.get(ConfigService);
  const environment = configService.get('NODE_ENV');
  const appPort = configService.get('PORT');
  const corsWhitelist = configService.get('CORS_WHITELIST_REGEXP');
  const sentryDsn = configService.get('SENTRY_DSN');
  const chainId = configService.get('CHAIN_ID');
  const secrets = configService.secrets;

  // versions
  app.enableVersioning({ type: VersioningType.URI });

  // logger
  app.useLogger(app.get(LOGGER_PROVIDER));

  // sentry
  const mask = satanizer([...commonPatterns, ...secrets]);
  const release = `${APP_NAME}@${APP_VERSION}`;
  // sentry is disabled for goerli
  if (chainId !== 5) {
    Sentry.init({
      dsn: sentryDsn,
      release,
      environment,
      beforeSend: (event) => {
        /*
         * We can only mask exact properties,
         * because there are circular references in event,
         * which breaks satanizer.
         */
        return {
          ...event,
          exception: mask(event.exception),
          breadcrumbs: mask(event.breadcrumbs),
          tags: mask(event.tags),
        };
      },
    });
  }

  // cors
  if (corsWhitelist !== '') {
    const whitelistRegexp = new RegExp(corsWhitelist);

    app.enableCors({
      origin(origin, callback) {
        if (!origin || whitelistRegexp.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
    });
  }

  // swagger
  const swaggerConfig = new DocumentBuilder().setTitle(APP_DESCRIPTION).setVersion(APP_VERSION).build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_URL, app, swaggerDocument);

  // app
  await app.listen(appPort, '0.0.0.0');
}
bootstrap();

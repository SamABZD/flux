import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { requestLogging } from './common/request-logging.middleware';
import type { Environment } from './config/environment';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  app.use(requestLogging);
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}

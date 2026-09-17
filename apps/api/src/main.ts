import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import type { Environment } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  const config = app.get(ConfigService<Environment, true>);
  const port = config.get('API_PORT', { infer: true });
  if (config.get('NODE_ENV', { infer: true }) === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  if (config.get('SERVE_FRONTEND', { infer: true })) {
    const webRoot = [
      resolve(process.cwd(), 'apps/web/dist'),
      resolve(process.cwd(), '../web/dist'),
      resolve(__dirname, '../../web/dist'),
    ].find((candidate) => existsSync(resolve(candidate, 'index.html')));
    if (!webRoot) throw new Error('Production frontend build is missing.');
    const indexPath = resolve(webRoot, 'index.html');
    app.setGlobalPrefix('api', {
      exclude: [{ path: 'health', method: RequestMethod.GET }],
    });
    app.useStaticAssets(webRoot, {
      index: false,
      setHeaders: (response: Response, filePath: string) => {
        response.setHeader(
          'Cache-Control',
          /\.[a-f0-9]{16,}\./.test(filePath)
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
        );
      },
    });
    app.use((request: Request, response: Response, next: NextFunction) => {
      if (
        !['GET', 'HEAD'].includes(request.method) ||
        request.path === '/health' ||
        request.path === '/api' ||
        request.path.startsWith('/api/') ||
        extname(request.path) ||
        !request.accepts('html')
      ) {
        next();
        return;
      }
      response.setHeader('Cache-Control', 'no-store');
      response.sendFile(indexPath);
    });
  }
  try {
    await app.listen(port, '0.0.0.0');
    Logger.log(`Flux API listening on port ${port}`, 'Bootstrap');
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch(() => {
  Logger.error(
    'API startup failed. Check environment configuration, PostgreSQL, and port availability.',
    undefined,
    'Bootstrap',
  );
  process.exitCode = 1;
});

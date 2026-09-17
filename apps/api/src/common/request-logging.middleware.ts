import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

export function requestLogging(request: Request, response: Response, next: NextFunction): void {
  const requestId = randomUUID();
  const started = performance.now();
  response.setHeader('X-Request-Id', requestId);
  response.once('finish', () => {
    logger.log({
      requestId,
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - started),
    });
  });
  next();
}

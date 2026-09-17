import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OperationError } from './operation-error';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    if (exception instanceof HttpException && status < 500) {
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else if ('message' in body && typeof body.message === 'string') message = body.message;
      else if (
        'message' in body &&
        Array.isArray(body.message) &&
        body.message.every((item: unknown) => typeof item === 'string')
      )
        message = body.message;
    }
    if (status === 404 && !(exception instanceof OperationError)) message = 'Not Found';
    const requestId = response.getHeader('X-Request-Id');
    if (status >= 500) {
      this.logger.error({
        requestId,
        statusCode: status,
        error: exception instanceof Error ? exception.name : 'UnknownError',
      });
    }
    response.status(status).json({
      statusCode: status,
      message,
      path: request.path,
      requestId,
      timestamp: new Date().toISOString(),
      ...(exception instanceof OperationError
        ? { code: exception.code, details: exception.details }
        : {}),
    });
  }
}

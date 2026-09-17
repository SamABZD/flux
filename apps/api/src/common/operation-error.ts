import { HttpException } from '@nestjs/common';
export class OperationError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status = 422,
    public readonly details: Record<string, string | number> = {},
  ) {
    super({ message, code, details }, status);
  }
}

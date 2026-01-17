import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constant';

export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ message, errorCode }, statusCode);
  }

  getErrorCode(): ErrorCode {
    return this.errorCode;
  }
}

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ErrorCodes, ErrorCode } from '../constants/error-codes.constant';
import {
  ErrorResponse,
  ValidationErrorDetail,
} from '../interfaces/error-response.interface';
import { BusinessException } from '../exceptions/business.exception';
import { isPrismaKnownError, mapPrismaError } from '../utils/error-mapper.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const errorResponse = this.buildErrorResponse(exception, request);

    this.logError(exception, errorResponse);

    response.status(errorResponse.statusCode).send(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: FastifyRequest,
  ): ErrorResponse {
    const baseResponse: Pick<ErrorResponse, 'timestamp' | 'path' | 'method'> = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    if (isPrismaKnownError(exception)) {
      const mapped = mapPrismaError(exception);
      return {
        ...baseResponse,
        statusCode: mapped.statusCode,
        message: mapped.message,
        errorCode: mapped.errorCode,
        ...(this.isDevelopment && { stack: exception.stack }),
      };
    }

    if (exception instanceof BusinessException) {
      return {
        ...baseResponse,
        statusCode: exception.getStatus(),
        message: exception.message,
        errorCode: exception.getErrorCode(),
        ...(this.isDevelopment && { stack: exception.stack }),
      };
    }

    if (exception instanceof BadRequestException) {
      const exceptionResponse = exception.getResponse();
      const validationErrors = this.extractValidationErrors(exceptionResponse);

      if (validationErrors.length > 0) {
        return {
          ...baseResponse,
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Validation failed',
          errorCode: ErrorCodes.VALIDATION_ERROR,
          errors: validationErrors,
          ...(this.isDevelopment && { stack: exception.stack }),
        };
      }

      return {
        ...baseResponse,
        statusCode: HttpStatus.BAD_REQUEST,
        message: this.extractMessage(exceptionResponse),
        errorCode: ErrorCodes.BAD_REQUEST,
        ...(this.isDevelopment && { stack: exception.stack }),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      return {
        ...baseResponse,
        statusCode: status,
        message: this.extractMessage(exceptionResponse),
        errorCode: this.mapStatusToErrorCode(status),
        ...(this.isDevelopment && { stack: exception.stack }),
      };
    }

    const errorMessage =
      exception instanceof Error ? exception.message : 'Internal server error';

    return {
      ...baseResponse,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.isDevelopment ? errorMessage : 'Internal server error',
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
      ...(this.isDevelopment &&
        exception instanceof Error && { stack: exception.stack }),
    };
  }

  private extractValidationErrors(
    response: string | object,
  ): ValidationErrorDetail[] {
    if (typeof response === 'object' && 'message' in response) {
      const messageValue = (response as { message: unknown }).message;
      if (Array.isArray(messageValue)) {
        return messageValue.map((msg) => {
          if (typeof msg === 'string') {
            const field = msg.split(' ')[0] || 'unknown';
            return { field, message: msg };
          }
          return { field: 'unknown', message: String(msg) };
        });
      }
    }
    return [];
  }

  private extractMessage(response: string | object): string {
    if (typeof response === 'string') {
      return response;
    }
    if (typeof response === 'object' && 'message' in response) {
      const message = (response as { message: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.join(', ');
      }
    }
    return 'An error occurred';
  }

  private mapStatusToErrorCode(status: HttpStatus): ErrorCode {
    const statusMap: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCodes.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCodes.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCodes.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCodes.CONFLICT,
    };

    return statusMap[status] ?? ErrorCodes.INTERNAL_SERVER_ERROR;
  }

  private logError(exception: unknown, errorResponse: ErrorResponse): void {
    const logContext = {
      method: errorResponse.method,
      path: errorResponse.path,
      statusCode: errorResponse.statusCode,
      errorCode: errorResponse.errorCode,
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        { ...logContext, err: exception },
        errorResponse.message,
      );
    } else {
      this.logger.warn(logContext, errorResponse.message);
    }
  }
}

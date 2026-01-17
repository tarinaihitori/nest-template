import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorCodes } from '../constants/error-codes.constant';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockLogger: PinoLogger;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
  let mockRequest: { url: string; method: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    } as unknown as PinoLogger;

    filter = new AllExceptionsFilter(mockLogger);

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    mockRequest = {
      url: '/test/path',
      method: 'GET',
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as ArgumentsHost;
  });

  describe('BusinessException処理', () => {
    it('BusinessExceptionを正しく処理すること', () => {
      // Arrange
      const exception = new BusinessException(
        ErrorCodes.USER_NOT_FOUND,
        'User with ID 1 not found',
        HttpStatus.NOT_FOUND,
      );

      // Act
      filter.catch(exception, mockHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'User with ID 1 not found',
          errorCode: ErrorCodes.USER_NOT_FOUND,
          path: '/test/path',
          method: 'GET',
        }),
      );
    });
  });

  describe('HttpException処理', () => {
    it('NotFoundExceptionを正しく処理すること', () => {
      // Arrange
      const exception = new NotFoundException('Resource not found');

      // Act
      filter.catch(exception, mockHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
          errorCode: ErrorCodes.NOT_FOUND,
        }),
      );
    });
  });

  describe('BadRequestException処理', () => {
    it('バリデーションエラーを正しく処理すること', () => {
      // Arrange
      const exception = new BadRequestException({
        message: ['email must be a valid email', 'name must be a string'],
        error: 'Bad Request',
      });

      // Act
      filter.catch(exception, mockHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Validation failed',
          errorCode: ErrorCodes.VALIDATION_ERROR,
          errors: expect.arrayContaining([
            expect.objectContaining({ message: 'email must be a valid email' }),
            expect.objectContaining({ message: 'name must be a string' }),
          ]),
        }),
      );
    });

    it('一般的なBadRequestExceptionを正しく処理すること', () => {
      // Arrange
      const exception = new BadRequestException('Invalid request');

      // Act
      filter.catch(exception, mockHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid request',
          errorCode: ErrorCodes.BAD_REQUEST,
        }),
      );
    });
  });

  describe('Prismaエラー処理', () => {
    it('ユニーク制約違反(P2002)を正しく処理すること', () => {
      // Arrange
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['email'] },
        },
      );

      // Act
      filter.catch(exception, mockHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          errorCode: ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION,
          message: 'Unique constraint violation on field(s): email',
        }),
      );
    });

    it('外部キー制約違反(P2003)を正しく処理すること', () => {
      // Arrange
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.0.0',
          meta: { field_name: 'userId' },
        },
      );

      // Act
      filter.catch(exception, mockHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          errorCode: ErrorCodes.FOREIGN_KEY_VIOLATION,
          message: 'Foreign key constraint failed on field: userId',
        }),
      );
    });

    it('レコード未発見(P2025)を正しく処理すること', () => {
      // Arrange
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        },
      );

      // Act
      filter.catch(exception, mockHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          errorCode: ErrorCodes.RECORD_NOT_FOUND,
          message: 'The requested record was not found',
        }),
      );
    });
  });

  describe('未知のエラー処理', () => {
    it('一般的なErrorを正しく処理すること', () => {
      // Arrange
      const exception = new Error('Something went wrong');

      // Act
      filter.catch(exception, mockHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        }),
      );
    });

    it('未知の例外を正しく処理すること', () => {
      // Arrange
      const exception = 'string error';

      // Act
      filter.catch(exception, mockHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        }),
      );
    });
  });

  describe('レスポンス形式', () => {
    it('timestamp, path, methodを含むこと', () => {
      // Arrange
      const exception = new NotFoundException('Not found');

      // Act
      filter.catch(exception, mockHost);

      // Assert
      const sentResponse = mockResponse.send.mock.calls[0][0];
      expect(sentResponse).toHaveProperty('timestamp');
      expect(sentResponse.path).toBe('/test/path');
      expect(sentResponse.method).toBe('GET');
    });
  });
});

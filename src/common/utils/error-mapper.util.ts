import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode, ErrorCodes } from '../constants/error-codes.constant';

export interface MappedPrismaError {
  statusCode: HttpStatus;
  errorCode: ErrorCode;
  message: string;
}

export function isPrismaKnownError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function mapPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): MappedPrismaError {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[]) || ['field'];
      return {
        statusCode: HttpStatus.CONFLICT,
        errorCode: ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION,
        message: `Unique constraint violation on field(s): ${target.join(', ')}`,
      };
    }
    case 'P2003': {
      const fieldName = (error.meta?.field_name as string) || 'field';
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: ErrorCodes.FOREIGN_KEY_VIOLATION,
        message: `Foreign key constraint failed on field: ${fieldName}`,
      };
    }
    case 'P2025': {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: ErrorCodes.RECORD_NOT_FOUND,
        message: 'The requested record was not found',
      };
    }
    default:
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: `Database error: ${error.message}`,
      };
  }
}

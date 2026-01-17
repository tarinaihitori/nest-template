import { ErrorCode } from '../constants/error-codes.constant';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  constraints?: Record<string, string>;
}

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  errorCode: ErrorCode | string;
  errors?: ValidationErrorDetail[];
  stack?: string;
}

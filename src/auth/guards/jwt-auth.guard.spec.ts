import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { JwtPayload } from '../interfaces';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  const createMockExecutionContext = (): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    guard = new JwtAuthGuard(reflector);
  });

  describe('canActivate', () => {
    describe('パブリックルート', () => {
      it('@Public()デコレーターがある場合は認証をスキップすること', () => {
        // Arrange
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(true);
        const context = createMockExecutionContext();

        // Act
        const result = guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
      });
    });
  });

  describe('handleRequest', () => {
    it('認証成功時はユーザーを返すこと', () => {
      // Arrange
      const mockUser: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      // Act
      const result = guard.handleRequest(null, mockUser, undefined);

      // Assert
      expect(result).toEqual(mockUser);
    });

    it('エラーがある場合はBusinessExceptionをスローすること', () => {
      // Arrange
      const error = new Error('Some error');

      // Act & Assert
      expect(() => guard.handleRequest(error, false, undefined)).toThrow(
        BusinessException,
      );
    });

    it('ユーザーがない場合はTOKEN_MISSINGをスローすること', () => {
      // Act & Assert
      try {
        guard.handleRequest(null, false, undefined);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_MISSING,
        );
      }
    });

    it('トークンがない場合のエラーをTOKEN_MISSINGに変換すること', () => {
      // Arrange
      const error = new Error('No auth token');

      // Act & Assert
      try {
        guard.handleRequest(null, false, error);
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessException);
        expect((err as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_MISSING,
        );
      }
    });

    it('トークン期限切れエラーをTOKEN_EXPIREDに変換すること', () => {
      // Arrange
      const error = new Error('jwt expired');

      // Act & Assert
      try {
        guard.handleRequest(error, false, undefined);
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessException);
        expect((err as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_EXPIRED,
        );
      }
    });

    it('その他のエラーをTOKEN_INVALIDに変換すること', () => {
      // Arrange
      const error = new Error('invalid signature');

      // Act & Assert
      try {
        guard.handleRequest(error, false, undefined);
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessException);
        expect((err as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_INVALID,
        );
      }
    });
  });
});

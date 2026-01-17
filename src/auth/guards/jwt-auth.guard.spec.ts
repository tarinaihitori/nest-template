import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtVerificationService } from '../services/jwt-verification.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { JwtPayload } from '../interfaces';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockLogger: PinoLogger;
  let jwtVerificationService: JwtVerificationService;
  let reflector: Reflector;

  const createMockExecutionContext = (
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const request = {
      headers,
      user: undefined as JwtPayload | undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    } as unknown as PinoLogger;

    jwtVerificationService = {
      verify: vi.fn(),
      extractRoles: vi.fn(),
      getRolesClaim: vi.fn(),
    } as unknown as JwtVerificationService;

    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    guard = new JwtAuthGuard(mockLogger, jwtVerificationService, reflector);
  });

  describe('パブリックルート', () => {
    it('トークンなしでパブリックルートにアクセスできること', async () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(true);
      const context = createMockExecutionContext({});

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(jwtVerificationService.verify).not.toHaveBeenCalled();
    });
  });

  describe('保護されたルート', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    });

    it('Authorizationヘッダーがない場合TOKEN_MISSINGをスローすること', async () => {
      // Arrange
      const context = createMockExecutionContext({});

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        BusinessException,
      );

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_MISSING,
        );
      }
    });

    it('Authorizationヘッダーの形式が不正な場合TOKEN_MISSINGをスローすること', async () => {
      // Arrange
      const context = createMockExecutionContext({
        authorization: 'Basic some-credentials',
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        BusinessException,
      );

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_MISSING,
        );
      }
    });

    it('Bearerトークンが空の場合TOKEN_MISSINGをスローすること', async () => {
      // Arrange
      const context = createMockExecutionContext({
        authorization: 'Bearer ',
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        BusinessException,
      );

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_MISSING,
        );
      }
    });

    it('有効なトークンを検証しリクエストにユーザーを設定すること', async () => {
      // Arrange
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
      };
      vi.mocked(jwtVerificationService.verify).mockResolvedValue(mockPayload);
      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(jwtVerificationService.verify).toHaveBeenCalledWith('valid-token');
      expect(context.switchToHttp().getRequest().user).toEqual(mockPayload);
    });

    it('検証サービスからのBusinessExceptionをそのままスローすること', async () => {
      // Arrange
      const businessError = new BusinessException(
        ErrorCodes.TOKEN_EXPIRED,
        'Token has expired',
        401,
      );
      vi.mocked(jwtVerificationService.verify).mockRejectedValue(businessError);
      const context = createMockExecutionContext({
        authorization: 'Bearer expired-token',
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(businessError);
    });

    it('予期しないエラーをTOKEN_INVALIDとしてラップすること', async () => {
      // Arrange
      vi.mocked(jwtVerificationService.verify).mockRejectedValue(
        new Error('Unexpected error'),
      );
      const context = createMockExecutionContext({
        authorization: 'Bearer bad-token',
      });

      // Act & Assert
      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_INVALID,
        );
      }
    });
  });
});

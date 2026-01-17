import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
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

  describe('public routes', () => {
    it('should allow access to public routes without token', async () => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(true);
      const context = createMockExecutionContext({});

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtVerificationService.verify).not.toHaveBeenCalled();
    });
  });

  describe('protected routes', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    });

    it('should throw TOKEN_MISSING when no authorization header', async () => {
      const context = createMockExecutionContext({});

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

    it('should throw TOKEN_MISSING when authorization header has wrong format', async () => {
      const context = createMockExecutionContext({
        authorization: 'Basic some-credentials',
      });

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

    it('should throw TOKEN_MISSING when Bearer token is empty', async () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer ',
      });

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

    it('should verify valid token and attach user to request', async () => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
      };
      vi.mocked(jwtVerificationService.verify).mockResolvedValue(mockPayload);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtVerificationService.verify).toHaveBeenCalledWith('valid-token');
      expect(context.switchToHttp().getRequest().user).toEqual(mockPayload);
    });

    it('should pass through BusinessException from verification service', async () => {
      const businessError = new BusinessException(
        ErrorCodes.TOKEN_EXPIRED,
        'Token has expired',
        401,
      );
      vi.mocked(jwtVerificationService.verify).mockRejectedValue(businessError);

      const context = createMockExecutionContext({
        authorization: 'Bearer expired-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(businessError);
    });

    it('should wrap unexpected errors as TOKEN_INVALID', async () => {
      vi.mocked(jwtVerificationService.verify).mockRejectedValue(
        new Error('Unexpected error'),
      );

      const context = createMockExecutionContext({
        authorization: 'Bearer bad-token',
      });

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

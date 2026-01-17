import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { JwtVerificationService } from '../services/jwt-verification.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { JwtPayload } from '../interfaces';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let jwtVerificationService: JwtVerificationService;
  let reflector: Reflector;

  const createMockExecutionContext = (user?: JwtPayload): ExecutionContext => {
    const request = {
      user,
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
    jwtVerificationService = {
      verify: vi.fn(),
      extractRoles: vi.fn(),
      getRolesClaim: vi.fn(),
    } as unknown as JwtVerificationService;

    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    guard = new RolesGuard(jwtVerificationService, reflector);
  });

  describe('ロールが不要な場合', () => {
    it('Rolesデコレーターがない場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
      const context = createMockExecutionContext({ sub: 'user-123' });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('ロール配列が空の場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue([]);
      const context = createMockExecutionContext({ sub: 'user-123' });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('ロールが必要な場合', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(['admin']);
    });

    it('ユーザーが認証されていない場合TOKEN_MISSINGをスローすること', () => {
      // Arrange
      const context = createMockExecutionContext(undefined);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(BusinessException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_MISSING,
        );
      }
    });

    it('ユーザーが必要なロールを持っている場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue([
        'admin',
        'user',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['admin', 'user'],
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('ユーザーが必要なロールを持っていない場合INSUFFICIENT_PERMISSIONSをスローすること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue(['user']);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['user'],
      });

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(BusinessException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.INSUFFICIENT_PERMISSIONS,
        );
        expect((error as BusinessException).message).toContain('admin');
      }
    });
  });

  describe('複数ロールが必要な場合', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue([
        'admin',
        'super-admin',
      ]);
    });

    it('ユーザーが必要なロールのいずれかを持っている場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue(['admin']);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['admin'],
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('ユーザーが別の必要なロールを持っている場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue([
        'super-admin',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['super-admin'],
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('ユーザーが必要なロールをどれも持っていない場合INSUFFICIENT_PERMISSIONSをスローすること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue([
        'user',
        'moderator',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['user', 'moderator'],
      });

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(BusinessException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.INSUFFICIENT_PERMISSIONS,
        );
      }
    });
  });

  describe('ユーザーがロールを持っていない場合', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(['admin']);
    });

    it('ユーザーのロール配列が空の場合INSUFFICIENT_PERMISSIONSをスローすること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue([]);
      const context = createMockExecutionContext({ sub: 'user-123' });

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(BusinessException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.INSUFFICIENT_PERMISSIONS,
        );
      }
    });
  });
});

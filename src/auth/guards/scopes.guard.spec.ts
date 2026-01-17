import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ScopesGuard } from './scopes.guard';
import { JwtVerificationService } from '../services/jwt-verification.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { JwtPayload } from '../interfaces';

describe('ScopesGuard', () => {
  let guard: ScopesGuard;
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
      extractScopes: vi.fn(),
      extractRoles: vi.fn(),
      getRolesClaim: vi.fn(),
      getScopesClaim: vi.fn(),
      getScopesDelimiter: vi.fn(),
    } as unknown as JwtVerificationService;

    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    guard = new ScopesGuard(jwtVerificationService, reflector);
  });

  describe('スコープが不要な場合', () => {
    it('Scopesデコレーターがない場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
      const context = createMockExecutionContext({ sub: 'user-123' });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('スコープ配列が空の場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue([]);
      const context = createMockExecutionContext({ sub: 'user-123' });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('スコープが必要な場合', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(['users:read']);
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

    it('ユーザーが必要なスコープを持っている場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([
        'users:read',
        'users:write',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: 'users:read users:write',
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('ユーザーが必要なスコープを持っていない場合INSUFFICIENT_SCOPEをスローすること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([
        'users:write',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: 'users:write',
      });

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(BusinessException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.INSUFFICIENT_SCOPE,
        );
        expect((error as BusinessException).message).toContain('users:read');
      }
    });
  });

  describe('複数スコープが必要な場合（OR条件）', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue([
        'users:write',
        'admin:write',
      ]);
    });

    it('ユーザーが必要なスコープのいずれかを持っている場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([
        'users:write',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: 'users:write',
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('ユーザーが別の必要なスコープを持っている場合アクセスを許可すること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([
        'admin:write',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: 'admin:write',
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('ユーザーが必要なスコープをどれも持っていない場合INSUFFICIENT_SCOPEをスローすること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([
        'users:read',
        'admin:read',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: 'users:read admin:read',
      });

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(BusinessException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.INSUFFICIENT_SCOPE,
        );
      }
    });
  });

  describe('ワイルドカードスコープ', () => {
    it('admin:*スコープがadmin:readにマッチすること', () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(['admin:read']);
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([
        'admin:*',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: 'admin:*',
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('admin:*スコープがadmin:writeにマッチすること', () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(['admin:write']);
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([
        'admin:*',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: 'admin:*',
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('admin:*スコープがusers:readにマッチしないこと', () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(['users:read']);
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([
        'admin:*',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: 'admin:*',
      });

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(BusinessException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.INSUFFICIENT_SCOPE,
        );
      }
    });

    it('*スコープが任意のスコープにマッチすること', () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue([
        'anything:whatever',
      ]);
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue(['*']);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: '*',
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('users:admin:*スコープがusers:admin:readにマッチすること', () => {
      // Arrange
      vi.mocked(reflector.getAllAndOverride).mockReturnValue([
        'users:admin:read',
      ]);
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([
        'users:admin:*',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        scope: 'users:admin:*',
      });

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('ユーザーがスコープを持っていない場合', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(['users:read']);
    });

    it('ユーザーのスコープ配列が空の場合INSUFFICIENT_SCOPEをスローすること', () => {
      // Arrange
      vi.mocked(jwtVerificationService.extractScopes).mockReturnValue([]);
      const context = createMockExecutionContext({ sub: 'user-123' });

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(BusinessException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.INSUFFICIENT_SCOPE,
        );
      }
    });
  });
});

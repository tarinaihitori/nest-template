import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../guards/roles.guard';
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

  describe('when no roles are required', () => {
    it('should allow access when no roles decorator is present', () => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
      const context = createMockExecutionContext({ sub: 'user-123' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when roles array is empty', () => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue([]);
      const context = createMockExecutionContext({ sub: 'user-123' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('when roles are required', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(['admin']);
    });

    it('should throw TOKEN_MISSING when user is not authenticated', () => {
      const context = createMockExecutionContext(undefined);

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

    it('should allow access when user has required role', () => {
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue([
        'admin',
        'user',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['admin', 'user'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw INSUFFICIENT_PERMISSIONS when user lacks required role', () => {
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue(['user']);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['user'],
      });

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

  describe('when multiple roles are required', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue([
        'admin',
        'super-admin',
      ]);
    });

    it('should allow access when user has any of the required roles', () => {
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue(['admin']);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['admin'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has another required role', () => {
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue([
        'super-admin',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['super-admin'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw INSUFFICIENT_PERMISSIONS when user has none of the required roles', () => {
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue([
        'user',
        'moderator',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-123',
        roles: ['user', 'moderator'],
      });

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

  describe('when user has no roles', () => {
    beforeEach(() => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValue(['admin']);
    });

    it('should throw INSUFFICIENT_PERMISSIONS when user has empty roles array', () => {
      vi.mocked(jwtVerificationService.extractRoles).mockReturnValue([]);
      const context = createMockExecutionContext({ sub: 'user-123' });

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

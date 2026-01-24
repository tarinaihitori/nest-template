import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IpRestrictionGuard } from './ip-restriction.guard';
import { IpRestrictionService } from '../services/ip-restriction.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { JwtPayload } from '../interfaces';

describe('IpRestrictionGuard', () => {
  let guard: IpRestrictionGuard;
  let ipRestrictionService: IpRestrictionService;
  let reflector: Reflector;

  const createMockExecutionContext = (
    user?: JwtPayload,
    ip?: string,
    headers?: Record<string, string | string[]>,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          ip: ip || '127.0.0.1',
          headers: headers || {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    ipRestrictionService = {
      isIpAllowed: vi.fn(),
    } as unknown as IpRestrictionService;

    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    guard = new IpRestrictionGuard(ipRestrictionService, reflector);
  });

  describe('canActivate', () => {
    describe('スキップデコレーター', () => {
      it('@Public()デコレーターがある場合はスキップすること', async () => {
        // Arrange
        vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
          if (key === 'isPublic') return true;
          return false;
        });
        const context = createMockExecutionContext();

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
        expect(ipRestrictionService.isIpAllowed).not.toHaveBeenCalled();
      });

      it('@SkipIpRestriction()デコレーターがある場合はスキップすること', async () => {
        // Arrange
        vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
          if (key === 'skipIpRestriction') return true;
          return false;
        });
        const context = createMockExecutionContext();

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
        expect(ipRestrictionService.isIpAllowed).not.toHaveBeenCalled();
      });
    });

    describe('認証チェック', () => {
      it('ユーザーが認証されていない場合はTOKEN_MISSINGをスローすること', async () => {
        // Arrange
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
        const context = createMockExecutionContext(undefined, '192.168.1.1');

        // Act & Assert
        await expect(guard.canActivate(context)).rejects.toThrow(
          BusinessException,
        );
        try {
          await guard.canActivate(context);
        } catch (error) {
          expect((error as BusinessException).getErrorCode()).toBe(
            ErrorCodes.TOKEN_MISSING,
          );
        }
      });
    });

    describe('IP制限チェック', () => {
      const mockUser: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      it('許可されたIPからのリクエストはtrueを返すこと', async () => {
        // Arrange
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
        vi.mocked(ipRestrictionService.isIpAllowed).mockResolvedValue(true);
        const context = createMockExecutionContext(mockUser, '192.168.1.1');

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
        expect(ipRestrictionService.isIpAllowed).toHaveBeenCalledWith(
          'user-123',
          '192.168.1.1',
        );
      });

      it('許可されていないIPからのリクエストはIP_NOT_ALLOWEDをスローすること', async () => {
        // Arrange
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
        vi.mocked(ipRestrictionService.isIpAllowed).mockResolvedValue(false);
        const context = createMockExecutionContext(mockUser, '10.0.0.1');

        // Act & Assert
        await expect(guard.canActivate(context)).rejects.toThrow(
          BusinessException,
        );
        try {
          await guard.canActivate(context);
        } catch (error) {
          expect((error as BusinessException).getErrorCode()).toBe(
            ErrorCodes.IP_NOT_ALLOWED,
          );
          expect((error as BusinessException).getStatus()).toBe(403);
        }
      });
    });

    describe('IPアドレス抽出', () => {
      const mockUser: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      it('X-Forwarded-Forヘッダーからプロキシ経由のIPを取得すること', async () => {
        // Arrange
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
        vi.mocked(ipRestrictionService.isIpAllowed).mockResolvedValue(true);
        const context = createMockExecutionContext(mockUser, '127.0.0.1', {
          'x-forwarded-for': '203.0.113.1, 198.51.100.1',
        });

        // Act
        await guard.canActivate(context);

        // Assert
        expect(ipRestrictionService.isIpAllowed).toHaveBeenCalledWith(
          'user-123',
          '203.0.113.1',
        );
      });

      it('X-Forwarded-Forヘッダーが配列の場合は最初の要素を使用すること', async () => {
        // Arrange
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
        vi.mocked(ipRestrictionService.isIpAllowed).mockResolvedValue(true);
        const context = createMockExecutionContext(mockUser, '127.0.0.1', {
          'x-forwarded-for': ['203.0.113.1', '198.51.100.1'],
        });

        // Act
        await guard.canActivate(context);

        // Assert
        expect(ipRestrictionService.isIpAllowed).toHaveBeenCalledWith(
          'user-123',
          '203.0.113.1',
        );
      });

      it('X-Forwarded-Forがない場合はrequest.ipを使用すること', async () => {
        // Arrange
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
        vi.mocked(ipRestrictionService.isIpAllowed).mockResolvedValue(true);
        const context = createMockExecutionContext(mockUser, '192.168.1.100');

        // Act
        await guard.canActivate(context);

        // Assert
        expect(ipRestrictionService.isIpAllowed).toHaveBeenCalledWith(
          'user-123',
          '192.168.1.100',
        );
      });
    });
  });
});

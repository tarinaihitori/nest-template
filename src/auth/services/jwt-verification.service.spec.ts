import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { JwtVerificationService } from './jwt-verification.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

describe('JwtVerificationService', () => {
  const TEST_SECRET = 'test-secret-key-for-jwt-verification';
  let service: JwtVerificationService;
  let configService: ConfigService;

  const createMockConfigService = (
    config: Record<string, string | undefined>,
  ) => {
    return {
      get: vi.fn((key: string) => config[key]),
    } as unknown as ConfigService;
  };

  describe('シークレットキーを使用する場合', () => {
    beforeEach(() => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_ALGORITHMS: 'HS256',
      });
      service = new JwtVerificationService(configService);
    });

    it('有効なトークンを検証できること', async () => {
      // Arrange
      const payload = { sub: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256' });

      // Act
      const result = await service.verify(token);

      // Assert
      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    it('期限切れトークンの場合TOKEN_EXPIREDをスローすること', async () => {
      // Arrange
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        expiresIn: '-1s',
      });

      // Act & Assert
      await expect(service.verify(token)).rejects.toThrow(BusinessException);

      try {
        await service.verify(token);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_EXPIRED,
        );
      }
    });

    it('署名が不正な場合TOKEN_INVALIDをスローすること', async () => {
      // Arrange
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, 'wrong-secret', { algorithm: 'HS256' });

      // Act & Assert
      await expect(service.verify(token)).rejects.toThrow(BusinessException);

      try {
        await service.verify(token);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_INVALID,
        );
      }
    });

    it('トークンの形式が不正な場合TOKEN_INVALIDをスローすること', async () => {
      // Arrange & Act & Assert
      await expect(service.verify('malformed-token')).rejects.toThrow(
        BusinessException,
      );

      try {
        await service.verify('malformed-token');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getErrorCode()).toBe(
          ErrorCodes.TOKEN_INVALID,
        );
      }
    });
  });

  describe('issuer検証を使用する場合', () => {
    beforeEach(() => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_ISSUER: 'https://auth.example.com',
        JWT_ALGORITHMS: 'HS256',
      });
      service = new JwtVerificationService(configService);
    });

    it('issuerが一致するトークンを検証できること', async () => {
      // Arrange
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        issuer: 'https://auth.example.com',
      });

      // Act
      const result = await service.verify(token);

      // Assert
      expect(result.sub).toBe('user-123');
    });

    it('issuerが異なるトークンを拒否すること', async () => {
      // Arrange
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        issuer: 'https://wrong-issuer.com',
      });

      // Act & Assert
      await expect(service.verify(token)).rejects.toThrow(BusinessException);
    });
  });

  describe('audience検証を使用する場合', () => {
    beforeEach(() => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_AUDIENCE: 'my-api',
        JWT_ALGORITHMS: 'HS256',
      });
      service = new JwtVerificationService(configService);
    });

    it('audienceが一致するトークンを検証できること', async () => {
      // Arrange
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        audience: 'my-api',
      });

      // Act
      const result = await service.verify(token);

      // Assert
      expect(result.sub).toBe('user-123');
    });

    it('audienceが異なるトークンを拒否すること', async () => {
      // Arrange
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        audience: 'wrong-api',
      });

      // Act & Assert
      await expect(service.verify(token)).rejects.toThrow(BusinessException);
    });
  });

  describe('extractRoles', () => {
    beforeEach(() => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_ROLES_CLAIM: 'roles',
      });
      service = new JwtVerificationService(configService);
    });

    it('シンプルなクレームからロールを抽出できること', () => {
      // Arrange
      const payload = { sub: 'user-123', roles: ['admin', 'user'] };

      // Act
      const roles = service.extractRoles(payload);

      // Assert
      expect(roles).toEqual(['admin', 'user']);
    });

    it('rolesクレームがない場合空配列を返すこと', () => {
      // Arrange
      const payload = { sub: 'user-123' };

      // Act
      const roles = service.extractRoles(payload);

      // Assert
      expect(roles).toEqual([]);
    });

    it('単一ロールの文字列を配列として処理すること', () => {
      // Arrange
      const payload = { sub: 'user-123', roles: 'admin' };

      // Act
      const roles = service.extractRoles(payload);

      // Assert
      expect(roles).toEqual(['admin']);
    });
  });

  describe('ネストしたクレームパスでのextractRoles', () => {
    beforeEach(() => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_ROLES_CLAIM: 'realm_access.roles',
      });
      service = new JwtVerificationService(configService);
    });

    it('ネストしたクレームからロールを抽出できること（Keycloak形式）', () => {
      // Arrange
      const payload = {
        sub: 'user-123',
        realm_access: {
          roles: ['admin', 'user'],
        },
      };

      // Act
      const roles = service.extractRoles(payload);

      // Assert
      expect(roles).toEqual(['admin', 'user']);
    });

    it('ネストしたパスが存在しない場合空配列を返すこと', () => {
      // Arrange
      const payload = { sub: 'user-123' };

      // Act
      const roles = service.extractRoles(payload);

      // Assert
      expect(roles).toEqual([]);
    });
  });

  describe('設定がない場合', () => {
    beforeEach(() => {
      configService = createMockConfigService({});
      service = new JwtVerificationService(configService);
    });

    it('JWKS URIもシークレットも設定されていない場合エラーをスローすること', async () => {
      // Arrange
      const token = jwt.sign({ sub: 'user-123' }, 'any-secret');

      // Act & Assert
      await expect(service.verify(token)).rejects.toThrow(
        'JWT verification is not configured',
      );
    });
  });

  describe('getRolesClaim', () => {
    it('設定されたrolesクレームを返すこと', () => {
      // Arrange
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_ROLES_CLAIM: 'custom.roles.path',
      });
      service = new JwtVerificationService(configService);

      // Act & Assert
      expect(service.getRolesClaim()).toBe('custom.roles.path');
    });

    it('未設定の場合デフォルトのrolesクレームを返すこと', () => {
      // Arrange
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
      });
      service = new JwtVerificationService(configService);

      // Act & Assert
      expect(service.getRolesClaim()).toBe('roles');
    });
  });

  describe('extractScopes', () => {
    describe('スペース区切りのスコープ文字列', () => {
      beforeEach(() => {
        configService = createMockConfigService({
          JWT_SECRET: TEST_SECRET,
          JWT_SCOPES_CLAIM: 'scope',
        });
        service = new JwtVerificationService(configService);
      });

      it('スペース区切りのスコープ文字列からスコープを抽出できること', () => {
        // Arrange
        const payload = { sub: 'user-123', scope: 'users:read users:write' };

        // Act
        const scopes = service.extractScopes(payload);

        // Assert
        expect(scopes).toEqual(['users:read', 'users:write']);
      });

      it('単一スコープを抽出できること', () => {
        // Arrange
        const payload = { sub: 'user-123', scope: 'users:read' };

        // Act
        const scopes = service.extractScopes(payload);

        // Assert
        expect(scopes).toEqual(['users:read']);
      });

      it('scopeクレームがない場合空配列を返すこと', () => {
        // Arrange
        const payload = { sub: 'user-123' };

        // Act
        const scopes = service.extractScopes(payload);

        // Assert
        expect(scopes).toEqual([]);
      });

      it('空のスコープ文字列の場合空配列を返すこと', () => {
        // Arrange
        const payload = { sub: 'user-123', scope: '' };

        // Act
        const scopes = service.extractScopes(payload);

        // Assert
        expect(scopes).toEqual([]);
      });
    });

    describe('配列形式のスコープ', () => {
      beforeEach(() => {
        configService = createMockConfigService({
          JWT_SECRET: TEST_SECRET,
          JWT_SCOPES_CLAIM: 'permissions',
        });
        service = new JwtVerificationService(configService);
      });

      it('配列形式のスコープを抽出できること（Auth0形式）', () => {
        // Arrange
        const payload = {
          sub: 'user-123',
          permissions: ['users:read', 'users:write'],
        };

        // Act
        const scopes = service.extractScopes(payload);

        // Assert
        expect(scopes).toEqual(['users:read', 'users:write']);
      });
    });

    describe('カスタム区切り文字', () => {
      beforeEach(() => {
        configService = createMockConfigService({
          JWT_SECRET: TEST_SECRET,
          JWT_SCOPES_CLAIM: 'scope',
          JWT_SCOPES_DELIMITER: ',',
        });
        service = new JwtVerificationService(configService);
      });

      it('カンマ区切りのスコープを抽出できること', () => {
        // Arrange
        const payload = { sub: 'user-123', scope: 'users:read,users:write' };

        // Act
        const scopes = service.extractScopes(payload);

        // Assert
        expect(scopes).toEqual(['users:read', 'users:write']);
      });

      it('区切り文字の前後にスペースがあっても正しく抽出できること', () => {
        // Arrange
        const payload = {
          sub: 'user-123',
          scope: 'users:read , users:write , admin:*',
        };

        // Act
        const scopes = service.extractScopes(payload);

        // Assert
        expect(scopes).toEqual(['users:read', 'users:write', 'admin:*']);
      });
    });

    describe('ネストしたクレームパス', () => {
      beforeEach(() => {
        configService = createMockConfigService({
          JWT_SECRET: TEST_SECRET,
          JWT_SCOPES_CLAIM: 'resource_access.api.scopes',
        });
        service = new JwtVerificationService(configService);
      });

      it('ネストしたパスからスコープを抽出できること', () => {
        // Arrange
        const payload = {
          sub: 'user-123',
          resource_access: {
            api: {
              scopes: ['users:read', 'users:write'],
            },
          },
        };

        // Act
        const scopes = service.extractScopes(payload);

        // Assert
        expect(scopes).toEqual(['users:read', 'users:write']);
      });

      it('ネストしたパスが存在しない場合空配列を返すこと', () => {
        // Arrange
        const payload = { sub: 'user-123' };

        // Act
        const scopes = service.extractScopes(payload);

        // Assert
        expect(scopes).toEqual([]);
      });
    });
  });

  describe('getScopesClaim', () => {
    it('設定されたscopesクレームを返すこと', () => {
      // Arrange
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_SCOPES_CLAIM: 'permissions',
      });
      service = new JwtVerificationService(configService);

      // Act & Assert
      expect(service.getScopesClaim()).toBe('permissions');
    });

    it('未設定の場合デフォルトのscopesクレームを返すこと', () => {
      // Arrange
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
      });
      service = new JwtVerificationService(configService);

      // Act & Assert
      expect(service.getScopesClaim()).toBe('scope');
    });
  });

  describe('getScopesDelimiter', () => {
    it('設定された区切り文字を返すこと', () => {
      // Arrange
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_SCOPES_DELIMITER: ',',
      });
      service = new JwtVerificationService(configService);

      // Act & Assert
      expect(service.getScopesDelimiter()).toBe(',');
    });

    it('未設定の場合デフォルトのスペースを返すこと', () => {
      // Arrange
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
      });
      service = new JwtVerificationService(configService);

      // Act & Assert
      expect(service.getScopesDelimiter()).toBe(' ');
    });
  });
});

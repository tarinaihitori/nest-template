import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JwtVerificationService } from './jwt-verification.service';

describe('JwtVerificationService', () => {
  let service: JwtVerificationService;
  let configService: ConfigService;

  const createMockConfigService = (
    config: Record<string, string | undefined>,
  ) => {
    return {
      get: vi.fn((key: string) => config[key]),
    } as unknown as ConfigService;
  };

  describe('extractRoles', () => {
    beforeEach(() => {
      configService = createMockConfigService({
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

  describe('extractScopes', () => {
    describe('スペース区切りのスコープ文字列', () => {
      beforeEach(() => {
        configService = createMockConfigService({
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
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

// passport-jwt のモックが必要なため、実際のストラテジー構築テストは
// 統合テストとして別途実施することを推奨

describe('JwtStrategy', () => {
  describe('constructor', () => {
    it('JWT_SECRETが設定されていない場合はエラーをスローすること', () => {
      // Arrange
      const configService = {
        get: vi.fn((key: string) => {
          if (key === 'JWT_SECRET') return undefined;
          return undefined;
        }),
      } as unknown as ConfigService;

      // Act & Assert
      expect(() => new JwtStrategy(configService)).toThrow(
        'JWT_SECRET environment variable is required',
      );
    });
  });

  describe('validate', () => {
    it('ペイロードをそのまま返すこと', () => {
      // Arrange
      const configService = {
        get: vi.fn((key: string) => {
          if (key === 'JWT_SECRET')
            return 'test-secret-key-that-is-at-least-32-chars';
          if (key === 'JWT_ISSUER') return 'test-issuer';
          return undefined;
        }),
      } as unknown as ConfigService;

      const strategy = new JwtStrategy(configService);
      const payload = { sub: 'user-123', email: 'test@example.com' };

      // Act
      const result = strategy.validate(payload);

      // Assert
      expect(result).toEqual(payload);
    });
  });
});

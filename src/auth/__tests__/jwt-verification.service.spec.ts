import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { JwtVerificationService } from '../services/jwt-verification.service';
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

  describe('with secret key', () => {
    beforeEach(() => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_ALGORITHMS: 'HS256',
      });
      service = new JwtVerificationService(configService);
    });

    it('should verify a valid token', async () => {
      const payload = { sub: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256' });

      const result = await service.verify(token);

      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw TOKEN_EXPIRED for expired tokens', async () => {
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        expiresIn: '-1s',
      });

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

    it('should throw TOKEN_INVALID for invalid signature', async () => {
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, 'wrong-secret', { algorithm: 'HS256' });

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

    it('should throw TOKEN_INVALID for malformed tokens', async () => {
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

  describe('with issuer validation', () => {
    beforeEach(() => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_ISSUER: 'https://auth.example.com',
        JWT_ALGORITHMS: 'HS256',
      });
      service = new JwtVerificationService(configService);
    });

    it('should verify token with matching issuer', async () => {
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        issuer: 'https://auth.example.com',
      });

      const result = await service.verify(token);

      expect(result.sub).toBe('user-123');
    });

    it('should reject token with wrong issuer', async () => {
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        issuer: 'https://wrong-issuer.com',
      });

      await expect(service.verify(token)).rejects.toThrow(BusinessException);
    });
  });

  describe('with audience validation', () => {
    beforeEach(() => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_AUDIENCE: 'my-api',
        JWT_ALGORITHMS: 'HS256',
      });
      service = new JwtVerificationService(configService);
    });

    it('should verify token with matching audience', async () => {
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        audience: 'my-api',
      });

      const result = await service.verify(token);

      expect(result.sub).toBe('user-123');
    });

    it('should reject token with wrong audience', async () => {
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        audience: 'wrong-api',
      });

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

    it('should extract roles from simple claim', () => {
      const payload = { sub: 'user-123', roles: ['admin', 'user'] };

      const roles = service.extractRoles(payload);

      expect(roles).toEqual(['admin', 'user']);
    });

    it('should return empty array if roles claim is missing', () => {
      const payload = { sub: 'user-123' };

      const roles = service.extractRoles(payload);

      expect(roles).toEqual([]);
    });

    it('should handle single role as string', () => {
      const payload = { sub: 'user-123', roles: 'admin' };

      const roles = service.extractRoles(payload);

      expect(roles).toEqual(['admin']);
    });
  });

  describe('extractRoles with nested claim path', () => {
    beforeEach(() => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_ROLES_CLAIM: 'realm_access.roles',
      });
      service = new JwtVerificationService(configService);
    });

    it('should extract roles from nested claim (Keycloak style)', () => {
      const payload = {
        sub: 'user-123',
        realm_access: {
          roles: ['admin', 'user'],
        },
      };

      const roles = service.extractRoles(payload);

      expect(roles).toEqual(['admin', 'user']);
    });

    it('should return empty array if nested path is missing', () => {
      const payload = { sub: 'user-123' };

      const roles = service.extractRoles(payload);

      expect(roles).toEqual([]);
    });
  });

  describe('without configuration', () => {
    beforeEach(() => {
      configService = createMockConfigService({});
      service = new JwtVerificationService(configService);
    });

    it('should throw error when neither JWKS URI nor secret is configured', async () => {
      const token = jwt.sign({ sub: 'user-123' }, 'any-secret');

      await expect(service.verify(token)).rejects.toThrow(
        'JWT verification is not configured',
      );
    });
  });

  describe('getRolesClaim', () => {
    it('should return configured roles claim', () => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
        JWT_ROLES_CLAIM: 'custom.roles.path',
      });
      service = new JwtVerificationService(configService);

      expect(service.getRolesClaim()).toBe('custom.roles.path');
    });

    it('should return default roles claim when not configured', () => {
      configService = createMockConfigService({
        JWT_SECRET: TEST_SECRET,
      });
      service = new JwtVerificationService(configService);

      expect(service.getRolesClaim()).toBe('roles');
    });
  });
});

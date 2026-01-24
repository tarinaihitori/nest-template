import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersRepository } from '../../users/users.repository';
import { RefreshTokenRepository } from '../repositories';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

vi.mock('argon2', () => ({
  hash: vi.fn(),
  verify: vi.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let usersRepository: UsersRepository;
  let refreshTokenRepository: RefreshTokenRepository;
  let jwtService: JwtService;

  const mockUsersRepository = {
    findByEmail: vi.fn(),
    findByEmailWithPassword: vi.fn(),
    createWithPassword: vi.fn(),
  };

  const mockRefreshTokenRepository = {
    create: vi.fn(),
    findByToken: vi.fn(),
    findByTokenWithUser: vi.fn(),
    revokeToken: vi.fn(),
    revokeAllUserTokens: vi.fn(),
  };

  const mockJwtService = {
    signAsync: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_ACCESS_TOKEN_EXPIRATION: '15m',
        JWT_REFRESH_TOKEN_EXPIRATION: '7d',
        JWT_ISSUER: 'test-issuer',
        PASSWORD_PEPPER: 'test-pepper',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: RefreshTokenRepository, useValue: mockRefreshTokenRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    refreshTokenRepository = module.get<RefreshTokenRepository>(RefreshTokenRepository);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('signup', () => {
    const signupDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    it('新規ユーザーを作成しトークンを返すこと', async () => {
      // Arrange
      mockUsersRepository.findByEmail.mockResolvedValue(null);
      vi.mocked(argon2.hash).mockResolvedValue('hashed-password');
      mockUsersRepository.createWithPassword.mockResolvedValue({
        id: 'user-123',
        email: signupDto.email,
        name: signupDto.name,
      });
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockRefreshTokenRepository.create.mockResolvedValue({
        token: 'refresh-token',
      });

      // Act
      const result = await authService.signup(signupDto);

      // Assert
      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe(signupDto.email);
      expect(result.tokens.accessToken).toBe('access-token');
      expect(mockUsersRepository.findByEmail).toHaveBeenCalledWith(signupDto.email);
      expect(argon2.hash).toHaveBeenCalledWith(signupDto.password + 'test-pepper');
    });

    it('メールアドレスが既に存在する場合はConflictExceptionをスローすること', async () => {
      // Arrange
      mockUsersRepository.findByEmail.mockResolvedValue({
        id: 'existing-user',
        email: signupDto.email,
      });

      // Act & Assert
      await expect(authService.signup(signupDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('正しい認証情報でトークンを返すこと', async () => {
      // Arrange
      mockUsersRepository.findByEmailWithPassword.mockResolvedValue({
        id: 'user-123',
        email: loginDto.email,
        password: 'hashed-password',
        name: 'Test User',
      });
      vi.mocked(argon2.verify).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockRefreshTokenRepository.create.mockResolvedValue({
        token: 'refresh-token',
      });

      // Act
      const result = await authService.login(loginDto);

      // Assert
      expect(result.user.id).toBe('user-123');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(argon2.verify).toHaveBeenCalledWith('hashed-password', loginDto.password + 'test-pepper');
    });

    it('ユーザーが存在しない場合はUnauthorizedExceptionをスローすること', async () => {
      // Arrange
      mockUsersRepository.findByEmailWithPassword.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('パスワードが間違っている場合はUnauthorizedExceptionをスローすること', async () => {
      // Arrange
      mockUsersRepository.findByEmailWithPassword.mockResolvedValue({
        id: 'user-123',
        email: loginDto.email,
        password: 'hashed-password',
        name: 'Test User',
      });
      vi.mocked(argon2.verify).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('有効なリフレッシュトークンで新しいトークンを返すこと', async () => {
      // Arrange
      const oldRefreshToken = 'old-refresh-token';
      mockRefreshTokenRepository.findByTokenWithUser.mockResolvedValue({
        token: oldRefreshToken,
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      });
      mockRefreshTokenRepository.revokeToken.mockResolvedValue({});
      mockJwtService.signAsync.mockResolvedValue('new-access-token');
      mockRefreshTokenRepository.create.mockResolvedValue({
        token: 'new-refresh-token',
      });

      // Act
      const result = await authService.refresh(oldRefreshToken);

      // Assert
      expect(result.accessToken).toBe('new-access-token');
      expect(mockRefreshTokenRepository.revokeToken).toHaveBeenCalledWith(oldRefreshToken);
    });

    it('無効なリフレッシュトークンの場合はUnauthorizedExceptionをスローすること', async () => {
      // Arrange
      mockRefreshTokenRepository.findByTokenWithUser.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('無効化されたリフレッシュトークンの場合はUnauthorizedExceptionをスローすること', async () => {
      // Arrange
      mockRefreshTokenRepository.findByTokenWithUser.mockResolvedValue({
        token: 'revoked-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      });

      // Act & Assert
      await expect(authService.refresh('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('期限切れのリフレッシュトークンの場合はUnauthorizedExceptionをスローすること', async () => {
      // Arrange
      mockRefreshTokenRepository.findByTokenWithUser.mockResolvedValue({
        token: 'expired-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 86400000),
        revokedAt: null,
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      });

      // Act & Assert
      await expect(authService.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('リフレッシュトークンを無効化すること', async () => {
      // Arrange
      const userId = 'user-123';
      const refreshToken = 'refresh-token';
      mockRefreshTokenRepository.findByToken.mockResolvedValue({
        token: refreshToken,
        userId,
      });
      mockRefreshTokenRepository.revokeToken.mockResolvedValue({});

      // Act
      await authService.logout(userId, refreshToken);

      // Assert
      expect(mockRefreshTokenRepository.revokeToken).toHaveBeenCalledWith(refreshToken);
    });

    it('別のユーザーのトークンは無効化しないこと', async () => {
      // Arrange
      const userId = 'user-123';
      const refreshToken = 'refresh-token';
      mockRefreshTokenRepository.findByToken.mockResolvedValue({
        token: refreshToken,
        userId: 'other-user',
      });

      // Act
      await authService.logout(userId, refreshToken);

      // Assert
      expect(mockRefreshTokenRepository.revokeToken).not.toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('ユーザーの全てのリフレッシュトークンを無効化すること', async () => {
      // Arrange
      const userId = 'user-123';
      mockRefreshTokenRepository.revokeAllUserTokens.mockResolvedValue({ count: 3 });

      // Act
      await authService.logoutAll(userId);

      // Assert
      expect(mockRefreshTokenRepository.revokeAllUserTokens).toHaveBeenCalledWith(userId);
    });
  });
});

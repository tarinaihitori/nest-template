import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersRepository } from '../../users/users.repository';
import { RefreshTokenRepository } from '../repositories';
import { SignupDto, LoginDto, AuthResponseDto, AuthTokensDto } from '../dto';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiration: string;
  private readonly refreshTokenExpiration: string;
  private readonly jwtIssuer: string;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenExpiration =
      this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '15m';
    this.refreshTokenExpiration =
      this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') || '7d';
    this.jwtIssuer =
      this.configService.get<string>('JWT_ISSUER') || 'nest-project';
  }

  async signup(signupDto: SignupDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersRepository.findByEmail(signupDto.email);
    if (existingUser) {
      throw new ConflictException({
        code: ErrorCodes.EMAIL_ALREADY_EXISTS,
        message: 'このメールアドレスは既に登録されています',
      });
    }

    const hashedPassword = await argon2.hash(signupDto.password);

    const user = await this.usersRepository.createWithPassword({
      email: signupDto.email,
      password: hashedPassword,
      name: signupDto.name,
    });

    const tokens = await this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersRepository.findByEmailWithPassword(
      loginDto.email,
    );

    if (!user || !user.password) {
      throw new UnauthorizedException({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: 'メールアドレスまたはパスワードが正しくありません',
      });
    }

    const isPasswordValid = await argon2.verify(user.password, loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: 'メールアドレスまたはパスワードが正しくありません',
      });
    }

    const tokens = await this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tokens,
    };
  }

  /**
   * リフレッシュトークンを使用して新しいトークンペアを発行する
   *
   * 処理フロー:
   * 1. リフレッシュトークンの存在確認
   * 2. トークンが無効化されていないか検証
   * 3. トークンの有効期限を検証
   * 4. 古いトークンを無効化（トークンローテーション）
   * 5. 新しいアクセストークンとリフレッシュトークンを発行
   *
   * セキュリティ:
   * - トークンローテーションにより、リフレッシュトークンの再利用を防止
   * - 漏洩したトークンが使用された場合、正規ユーザーの次回リフレッシュ時に検知可能
   *
   * @param refreshToken - クライアントから送信されたリフレッシュトークン
   * @returns 新しいアクセストークンとリフレッシュトークンのペア
   * @throws UnauthorizedException - トークンが無効/無効化済み/期限切れの場合
   */
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const tokenRecord =
      await this.refreshTokenRepository.findByTokenWithUser(refreshToken);

    if (!tokenRecord) {
      throw new UnauthorizedException({
        code: ErrorCodes.REFRESH_TOKEN_INVALID,
        message: 'リフレッシュトークンが無効です',
      });
    }

    if (tokenRecord.revokedAt) {
      throw new UnauthorizedException({
        code: ErrorCodes.REFRESH_TOKEN_REVOKED,
        message: 'リフレッシュトークンは無効化されています',
      });
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCodes.REFRESH_TOKEN_EXPIRED,
        message: 'リフレッシュトークンの有効期限が切れています',
      });
    }

    // Revoke the old token (rotation)
    await this.refreshTokenRepository.revokeToken(refreshToken);

    // Generate new tokens
    return this.generateTokens(tokenRecord.userId);
  }

  /**
   * 現在のセッションからログアウトする
   *
   * 処理フロー:
   * 1. リフレッシュトークンの存在確認
   * 2. トークンの所有者が現在のユーザーであることを検証
   * 3. トークンを無効化
   *
   * セキュリティ:
   * - 所有者検証により、他ユーザーのトークンを無効化することを防止
   * - トークンが存在しない場合や所有者が異なる場合はエラーを投げず静かに終了
   *   （ログアウト操作の冪等性を保証）
   *
   * @param userId - 現在認証済みのユーザーID
   * @param refreshToken - 無効化するリフレッシュトークン
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenRecord =
      await this.refreshTokenRepository.findByToken(refreshToken);

    if (tokenRecord && tokenRecord.userId === userId) {
      await this.refreshTokenRepository.revokeToken(refreshToken);
    }
  }

  /**
   * 全デバイス/セッションからログアウトする
   *
   * 処理フロー:
   * 1. 指定ユーザーの全リフレッシュトークンを無効化
   *
   * ユースケース:
   * - パスワード変更後の全セッション無効化
   * - アカウント侵害時の緊急対応
   * - ユーザーが「すべてのデバイスからログアウト」を選択した場合
   *
   * @param userId - ログアウトするユーザーのID
   */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllUserTokens(userId);
  }

  /**
   * アクセストークンとリフレッシュトークンのペアを生成する
   *
   * 処理フロー:
   * 1. JWTアクセストークンを生成（署名付き、有効期限: 短期間）
   * 2. リフレッシュトークンをランダム生成（有効期限: 長期間）
   * 3. リフレッシュトークンをデータベースに保存
   *
   * トークンの役割:
   * - アクセストークン: API認証に使用、短い有効期限（デフォルト15分）
   * - リフレッシュトークン: 新しいトークンペアの取得に使用、長い有効期限（デフォルト7日）
   *
   * セキュリティ:
   * - アクセストークンは短命のためステートレス（DB照会不要）
   * - リフレッシュトークンはDB管理により即時無効化が可能
   * - randomBytes(32)で256ビットのエントロピーを確保
   *
   * @param userId - トークンを発行するユーザーのID
   * @returns アクセストークンとリフレッシュトークンのペア
   */
  private async generateTokens(userId: string): Promise<AuthTokensDto> {
    const accessToken = await this.jwtService.signAsync({ sub: userId }, {
      expiresIn: this.accessTokenExpiration,
      issuer: this.jwtIssuer,
    } as Parameters<typeof this.jwtService.signAsync>[1]);

    const refreshTokenValue = randomBytes(32).toString('hex');
    const refreshTokenExpiresAt = this.calculateExpirationDate(
      this.refreshTokenExpiration,
    );

    await this.refreshTokenRepository.create({
      token: refreshTokenValue,
      userId,
      expiresAt: refreshTokenExpiresAt,
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  private calculateExpirationDate(expiration: string): Date {
    const now = new Date();
    const match = expiration.match(/^(\d+)([smhd])$/);

    if (!match) {
      // Default to 7 days
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}

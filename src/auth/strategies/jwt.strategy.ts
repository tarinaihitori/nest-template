import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { JwtPayload } from '../interfaces';

/**
 * JWT認証ストラテジー
 *
 * passport-jwtを使用してJWTトークンの検証を行う。
 * 内部シークレットを使用してHS256署名を検証する。
 *
 * ## 環境変数
 * | 変数名 | 必須 | 説明 |
 * |--------|------|------|
 * | JWT_SECRET | ○ | JWT署名用シークレットキー（32文字以上推奨） |
 * | JWT_ISSUER | - | 許可するissuer |
 *
 * @example
 * ```typescript
 * // モジュールに登録して使用
 * @Module({
 *   imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
 *   providers: [JwtStrategy],
 * })
 * export class AuthModule {}
 * ```
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    const issuer = configService.get<string>('JWT_ISSUER');

    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      issuer: issuer || undefined,
      algorithms: ['HS256'],
    });
  }

  /**
   * トークン検証成功時に呼ばれるコールバック
   *
   * 検証済みのペイロードをそのまま返す。
   * 戻り値は request.user に設定される。
   *
   * @param payload - 検証済みのJWTペイロード
   * @returns JWTペイロード
   */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}

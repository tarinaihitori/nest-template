import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

/**
 * JWT認証ガード
 *
 * すべてのリクエストに対してJWTトークンの検証を行うグローバルガード。
 * `@Public()` デコレーターが付与されたエンドポイントは認証をスキップする。
 *
 * passport-jwtを使用してトークン検証を行い、検証成功時は
 * ペイロードを `request.user` に自動設定する。
 *
 * ## 認証フロー
 * 1. `@Public()` メタデータをチェック（存在すれば認証スキップ）
 * 2. passport-jwtがAuthorizationヘッダーからトークンを抽出
 * 3. JwtStrategyでトークンを検証（JWKSから公開鍵を取得）
 * 4. 検証済みペイロードが `request.user` に自動設定される
 *
 * ## エラーコード
 * - `TOKEN_MISSING`: Authorizationヘッダーがない、またはトークンが抽出できない
 * - `TOKEN_INVALID`: トークンの署名が無効、または形式が不正
 * - `TOKEN_EXPIRED`: トークンの有効期限切れ
 *
 * @example
 * ```typescript
 * // 認証が必要なエンドポイント（デフォルト）
 * @Get('profile')
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return user;
 * }
 *
 * // 認証をスキップするエンドポイント
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * リクエストの認証を検証する
   *
   * @Public() デコレーターが付与されている場合は認証をスキップし、
   * それ以外の場合はpassport-jwtによる認証を実行する。
   *
   * @param context - 実行コンテキスト
   * @returns 認証成功時はtrue、@Public()の場合もtrue
   */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * passport認証結果を処理する
   *
   * passport-jwtの認証結果を受け取り、エラーがあればBusinessExceptionに変換する。
   * 認証成功時はuserオブジェクトをそのまま返す。
   *
   * @param err - 認証エラー（存在する場合）
   * @param user - 認証済みユーザー（JWTペイロード）
   * @param info - 追加情報（エラー詳細など）
   * @returns 認証済みユーザー
   * @throws {BusinessException} 認証失敗時
   */
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false,
    info: Error | undefined,
  ): TUser {
    if (err) {
      throw this.convertToBusinessException(err);
    }

    if (!user) {
      throw this.convertToBusinessException(info);
    }

    return user;
  }

  /**
   * エラーをBusinessExceptionに変換する
   *
   * passport-jwtのエラーを適切なエラーコードを持つBusinessExceptionに変換する。
   *
   * @param error - 変換元のエラー
   * @returns BusinessException
   */
  private convertToBusinessException(
    error: Error | undefined,
  ): BusinessException {
    if (!error) {
      return new BusinessException(
        ErrorCodes.TOKEN_MISSING,
        'Authorization token is required',
        401,
      );
    }

    const message = error.message?.toLowerCase() || '';

    // トークンがない場合
    if (
      message.includes('no auth token') ||
      message.includes('jwt must be provided')
    ) {
      return new BusinessException(
        ErrorCodes.TOKEN_MISSING,
        'Authorization token is required',
        401,
      );
    }

    // トークンの有効期限切れ
    if (message.includes('jwt expired') || message.includes('token expired')) {
      return new BusinessException(
        ErrorCodes.TOKEN_EXPIRED,
        'Token has expired',
        401,
      );
    }

    // その他のエラーはTOKEN_INVALIDとして処理
    return new BusinessException(
      ErrorCodes.TOKEN_INVALID,
      `Invalid token: ${error.message || 'Token verification failed'}`,
      401,
    );
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { JwtVerificationService } from '../services';
import { SCOPES_KEY } from '../decorators';
import { JwtPayload } from '../interfaces';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

/**
 * スコープ認可ガード
 *
 * `@Scopes()` デコレーターで指定されたスコープを持つユーザーのみアクセスを許可する。
 * スコープの検証はOR条件で行われ、ワイルドカードマッチングにも対応。
 *
 * ## ワイルドカードマッチング
 * - `*`: すべてのスコープにマッチ
 * - `prefix:*`: 指定されたプレフィックスで始まるすべてのスコープにマッチ
 *   - 例: `admin:*` は `admin:read`, `admin:write`, `admin:delete` にマッチ
 *
 * ## 動作
 * 1. `@Scopes()` メタデータから必要なスコープを取得
 * 2. スコープが指定されていない場合はアクセスを許可
 * 3. ユーザーのJWTペイロードからスコープを抽出
 * 4. 必要なスコープのいずれかにマッチするかチェック（OR条件）
 *
 * ## エラーコード
 * - `TOKEN_MISSING`: ユーザーが認証されていない
 * - `INSUFFICIENT_SCOPE`: 必要なスコープを持っていない
 *
 * @example
 * ```typescript
 * // 単一スコープの指定
 * @Scopes('read:users')
 * @Get('users')
 * listUsers() {}
 *
 * // 複数スコープの指定（OR条件）
 * @Scopes('write:users', 'admin:*')
 * @Post('users')
 * createUser() {}
 * ```
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(
    private readonly jwtVerificationService: JwtVerificationService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * リクエストのスコープ認可を検証する
   *
   * @param context - 実行コンテキスト
   * @returns スコープ検証成功時はtrue
   * @throws {BusinessException} TOKEN_MISSING - ユーザーが認証されていない場合
   * @throws {BusinessException} INSUFFICIENT_SCOPE - 必要なスコープを持っていない場合
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user?: JwtPayload }).user;

    if (!user) {
      throw new BusinessException(
        ErrorCodes.TOKEN_MISSING,
        'User not authenticated',
        401,
      );
    }

    const userScopes = this.jwtVerificationService.extractScopes(user);
    const hasScope = requiredScopes.some((requiredScope) =>
      this.matchesScope(userScopes, requiredScope),
    );

    if (!hasScope) {
      throw new BusinessException(
        ErrorCodes.INSUFFICIENT_SCOPE,
        `Required scopes: ${requiredScopes.join(', ')}`,
        403,
      );
    }

    return true;
  }

  /**
   * ユーザーのスコープが必要なスコープにマッチするかチェックする
   *
   * 以下のマッチングルールを適用:
   * 1. 完全一致: `userScope === requiredScope`
   * 2. 全権限ワイルドカード: ユーザーが `*` を持っている場合、すべてにマッチ
   * 3. プレフィックスワイルドカード: `admin:*` は `admin:read`, `admin:write` などにマッチ
   *
   * @param userScopes - ユーザーが持つスコープの配列
   * @param requiredScope - 必要なスコープ
   * @returns マッチする場合はtrue
   *
   * @example
   * ```typescript
   * // 完全一致
   * matchesScope(['read', 'write'], 'read'); // => true
   *
   * // 全権限ワイルドカード
   * matchesScope(['*'], 'admin:delete'); // => true
   *
   * // プレフィックスワイルドカード
   * matchesScope(['admin:*'], 'admin:read'); // => true
   * matchesScope(['admin:*'], 'user:read'); // => false
   * ```
   */
  private matchesScope(userScopes: string[], requiredScope: string): boolean {
    return userScopes.some((userScope) => {
      // 完全一致
      if (userScope === requiredScope) {
        return true;
      }

      // 全権限ワイルドカード: ユーザーが `*` を持っている場合、すべてにマッチ
      if (userScope === '*') {
        return true;
      }

      // プレフィックスワイルドカード: `admin:*` は `admin:read`, `admin:write` などにマッチ
      if (userScope.endsWith(':*')) {
        const prefix = userScope.slice(0, -1); // 末尾の `*` を削除し、`admin:` を残す
        return requiredScope.startsWith(prefix);
      }

      return false;
    });
  }
}

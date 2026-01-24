import { SetMetadata } from '@nestjs/common';

/**
 * スコープメタデータを格納するキー
 * @internal
 */
export const SCOPES_KEY = 'scopes';

/**
 * エンドポイントに必要なスコープを指定するデコレーター
 *
 * 指定されたスコープのいずれかを持つユーザーのみがアクセスできる。
 * 複数のスコープを指定した場合はOR条件で評価される。
 * ワイルドカードマッチング（`*`, `prefix:*`）に対応。
 *
 * @param scopes - 必要なスコープ（可変長引数）
 * @returns メタデータを設定するデコレーター
 *
 * @example
 * ```typescript
 * // 単一スコープの指定
 * @Scopes('read:users')
 * @Get('users')
 * listUsers() {}
 *
 * // 複数スコープの指定（OR条件）
 * @Scopes('write:posts', 'admin:posts')
 * @Post('posts')
 * createPost() {}
 *
 * // ユーザー側のワイルドカードスコープ
 * // ユーザーが `admin:*` を持っている場合、`admin:read`, `admin:write` などにアクセス可能
 * @Scopes('admin:read')
 * @Get('admin/settings')
 * getSettings() {}
 *
 * // コントローラー全体にスコープを適用
 * @Scopes('api:access')
 * @Controller('api')
 * export class ApiController {}
 * ```
 *
 * @see ScopesGuard - スコープ検証とワイルドカードマッチングの実装
 */
export const Scopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);

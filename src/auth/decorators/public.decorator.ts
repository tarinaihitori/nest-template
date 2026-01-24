import { SetMetadata } from '@nestjs/common';

/**
 * 公開エンドポイントを示すメタデータキー
 * @internal
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 認証をスキップするエンドポイントを指定するデコレーター
 *
 * このデコレーターを付与したエンドポイントは、JwtAuthGuardによる
 * JWT認証をスキップし、認証なしでアクセス可能になる。
 *
 * @returns メタデータを設定するデコレーター
 *
 * @example
 * ```typescript
 * // ヘルスチェックエンドポイント
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 *
 * // ログインエンドポイント
 * @Public()
 * @Post('login')
 * login(@Body() credentials: LoginDto) {
 *   return this.authService.login(credentials);
 * }
 *
 * // コントローラー全体を公開する場合
 * @Public()
 * @Controller('public')
 * export class PublicController {}
 * ```
 *
 * @see JwtAuthGuard - 認証ガードの実装
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

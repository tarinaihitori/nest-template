import { SetMetadata } from '@nestjs/common';

/**
 * ロールメタデータを格納するキー
 * @internal
 */
export const ROLES_KEY = 'roles';

/**
 * エンドポイントに必要なロールを指定するデコレーター
 *
 * 指定されたロールのいずれかを持つユーザーのみがアクセスできる。
 * 複数のロールを指定した場合はOR条件で評価される。
 *
 * @param roles - 必要なロール名（可変長引数）
 * @returns メタデータを設定するデコレーター
 *
 * @example
 * ```typescript
 * // 単一ロールの指定
 * @Roles('admin')
 * @Get('admin/users')
 * listAllUsers() {}
 *
 * // 複数ロールの指定（OR条件: adminまたはmoderatorのいずれかを持っていればOK）
 * @Roles('admin', 'moderator')
 * @Delete('posts/:id')
 * deletePost() {}
 *
 * // コントローラー全体にロールを適用
 * @Roles('admin')
 * @Controller('admin')
 * export class AdminController {}
 * ```
 *
 * @see RolesGuard - ロール検証の実装
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

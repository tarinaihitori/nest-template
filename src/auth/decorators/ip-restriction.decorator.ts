import { SetMetadata } from '@nestjs/common';

/**
 * IP制限スキップを示すメタデータキー
 * @internal
 */
export const SKIP_IP_RESTRICTION_KEY = 'skipIpRestriction';

/**
 * IP制限チェックをスキップするエンドポイントを指定するデコレーター
 *
 * このデコレーターを付与したエンドポイントは、IpRestrictionGuardによる
 * IP制限チェックをスキップする。
 *
 * @returns メタデータを設定するデコレーター
 *
 * @example
 * ```typescript
 * // IP制限をスキップするエンドポイント
 * @SkipIpRestriction()
 * @Get('public-data')
 * getPublicData() {
 *   return { data: 'public' };
 * }
 *
 * // コントローラー全体でIP制限をスキップする場合
 * @SkipIpRestriction()
 * @Controller('public')
 * export class PublicController {}
 * ```
 *
 * @see IpRestrictionGuard - IP制限ガードの実装
 */
export const SkipIpRestriction = () => SetMetadata(SKIP_IP_RESTRICTION_KEY, true);

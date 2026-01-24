import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { IpRestrictionService } from '../services/ip-restriction.service';
import {
  SKIP_IP_RESTRICTION_KEY,
  IS_PUBLIC_KEY,
} from '../decorators';
import { JwtPayload } from '../interfaces';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

/**
 * IP制限ガード
 *
 * ユーザーごとに許可されたIPアドレスからのみアクセスを許可する。
 * JwtAuthGuardの後に実行され、認証済みユーザーのIDを使用して
 * データベースから許可IPリストを取得し、リクエスト元IPと照合する。
 *
 * ## 動作
 * 1. `@SkipIpRestriction()` メタデータをチェック（存在すればスキップ）
 * 2. 認証済みユーザーのsubを取得
 * 3. DBから許可IPリストを取得
 * 4. 許可IPが空なら全IP許可
 * 5. リクエストIPが許可リストにあるかチェック
 * 6. 許可されていなければ IP_NOT_ALLOWED (403) をスロー
 *
 * ## Guard実行順序
 * ```
 * Request → JwtAuthGuard → IpRestrictionGuard → RolesGuard → ScopesGuard → Controller
 * ```
 *
 * ## エラーコード
 * - `TOKEN_MISSING`: ユーザーが認証されていない
 * - `IP_NOT_ALLOWED`: IPアドレスが許可されていない
 *
 * @example
 * ```typescript
 * // IP制限が有効なエンドポイント（デフォルト）
 * @Get('profile')
 * getProfile() {}
 *
 * // IP制限をスキップするエンドポイント
 * @SkipIpRestriction()
 * @Get('public')
 * publicEndpoint() {}
 * ```
 */
@Injectable()
export class IpRestrictionGuard implements CanActivate {
  constructor(
    private readonly ipRestrictionService: IpRestrictionService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * リクエストのIP制限を検証する
   *
   * @param context - 実行コンテキスト
   * @returns IP検証成功時はtrue
   * @throws {BusinessException} TOKEN_MISSING - ユーザーが認証されていない場合
   * @throws {BusinessException} IP_NOT_ALLOWED - IPアドレスが許可されていない場合
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @Public() デコレーターをチェック（公開エンドポイントはスキップ）
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // @SkipIpRestriction() デコレーターをチェック
    const skipIpRestriction = this.reflector.getAllAndOverride<boolean>(
      SKIP_IP_RESTRICTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipIpRestriction) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user?: JwtPayload }).user;

    // 認証されていない場合（JwtAuthGuardを通過していない場合）
    if (!user) {
      throw new BusinessException(
        ErrorCodes.TOKEN_MISSING,
        'User not authenticated',
        401,
      );
    }

    const clientIp = this.extractClientIp(request);
    const isAllowed = await this.ipRestrictionService.isIpAllowed(
      user.sub,
      clientIp,
    );

    if (!isAllowed) {
      throw new BusinessException(
        ErrorCodes.IP_NOT_ALLOWED,
        `Access denied from IP address: ${clientIp}`,
        403,
      );
    }

    return true;
  }

  /**
   * リクエストからクライアントIPアドレスを抽出する
   *
   * プロキシ経由の場合はX-Forwarded-Forヘッダーを優先し、
   * なければ直接接続のIPアドレスを使用する。
   *
   * @param request - Fastifyリクエスト
   * @returns クライアントIPアドレス
   */
  private extractClientIp(request: FastifyRequest): string {
    // X-Forwarded-Forヘッダーから取得（プロキシ経由の場合）
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // カンマ区切りの場合は最初のIPを取得
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    // 直接接続のIPアドレス
    return request.ip || 'unknown';
  }
}

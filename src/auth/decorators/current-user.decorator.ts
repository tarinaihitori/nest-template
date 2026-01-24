import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { JwtPayload } from '../interfaces';

/**
 * 認証済みユーザー情報を取得するパラメーターデコレーター
 *
 * JwtAuthGuardで検証されたJWTペイロードをコントローラーのハンドラーで
 * 取得するために使用する。特定のプロパティのみを取得することも可能。
 *
 * @param data - 取得するプロパティ名（省略時はペイロード全体を取得）
 * @returns JWTペイロードまたは指定されたプロパティの値
 *
 * @example
 * ```typescript
 * // ペイロード全体を取得
 * @Get('profile')
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return { userId: user.sub, email: user.email };
 * }
 *
 * // 特定のプロパティのみ取得
 * @Get('my-id')
 * getMyId(@CurrentUser('sub') userId: string) {
 *   return { userId };
 * }
 *
 * // 認証されていない場合はundefinedが返る
 * // （@Public()と併用した場合など）
 * @Public()
 * @Get('optional-auth')
 * optionalAuth(@CurrentUser() user?: JwtPayload) {
 *   return user ? `Hello, ${user.sub}` : 'Hello, guest';
 * }
 * ```
 *
 * @see JwtAuthGuard - ユーザー情報をリクエストに格納するガード
 * @see JwtPayload - ペイロードの型定義
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user?: JwtPayload }).user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);

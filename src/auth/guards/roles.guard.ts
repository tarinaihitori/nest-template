import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { JwtVerificationService } from '../services';
import { ROLES_KEY } from '../decorators';
import { JwtPayload } from '../interfaces';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

/**
 * ロール認可ガード
 *
 * `@Roles()` デコレーターで指定されたロールを持つユーザーのみアクセスを許可する。
 * ロールの検証はOR条件で行われ、指定されたロールのいずれか1つを持っていればアクセス可能。
 *
 * ## 動作
 * 1. `@Roles()` メタデータから必要なロールを取得
 * 2. ロールが指定されていない場合はアクセスを許可
 * 3. ユーザーのJWTペイロードからロールを抽出
 * 4. 必要なロールのいずれかを持っているかチェック（OR条件）
 *
 * ## エラーコード
 * - `TOKEN_MISSING`: ユーザーが認証されていない
 * - `INSUFFICIENT_PERMISSIONS`: 必要なロールを持っていない
 *
 * @example
 * ```typescript
 * // 単一ロールの指定
 * @Roles('admin')
 * @Get('admin/dashboard')
 * adminDashboard() {}
 *
 * // 複数ロールの指定（OR条件）
 * @Roles('admin', 'moderator')
 * @Delete('posts/:id')
 * deletePost() {}
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly jwtVerificationService: JwtVerificationService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * リクエストのロール認可を検証する
   *
   * @param context - 実行コンテキスト
   * @returns ロール検証成功時はtrue
   * @throws {BusinessException} TOKEN_MISSING - ユーザーが認証されていない場合
   * @throws {BusinessException} INSUFFICIENT_PERMISSIONS - 必要なロールを持っていない場合
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user?: JwtPayload }).user;
/*
  1. FastifyRequest & { user?: JwtPayload }                                                                                                                                                                
                                                                                                                                                                                                           
  交差型（Intersection Type） です。2つの型を合成しています:                                                                                                                                               
                                                                                                                                                                                                           
  - FastifyRequest - Fastifyの標準リクエスト型                                                                                                                                                             
  - { user?: JwtPayload } - user プロパティを追加した型                                                                                                                                                    
                                                                                                                                                                                                           
  // つまりこういう型になる                                                                                                                                                                                
  {                                                                                                                                                                                                        
    // FastifyRequest の全プロパティ                                                                                                                                                                       
    headers: { ... },                                                                                                                                                                                      
    body: { ... },                                                                                                                                                                                         
    params: { ... },                                                                                                                                                                                       
    // ...                                                                                                                                                                                                 
                                                                                                                                                                                                           
    // 追加したプロパティ                                                                                                                                                                                  
    user?: JwtPayload  // オプショナル（あってもなくてもよい）                                                                                                                                             
  }                                                                                                                                                                                                        
                                                                                                                                                                                                           
  2. request as ...                                                                                                                                                                                        
                                                                                                                                                                                                           
  型アサーション です。TypeScript に「この request は上記の型として扱ってね」と伝えています。                                                                                                              
                                                                                                                                                                                                           
  3. .user                                                                                                                                                                                                 
                                                                                                                                                                                                           
  型アサーション後、user プロパティにアクセスしています。                                                                                                                                                  
                                                                                                                                                                                                           
  なぜ必要か                                                                                                                                                                                               
                                                                                                                                                                                                           
  FastifyRequest の標準型には user プロパティが存在しません。しかし JwtAuthGuard で以下のように user を追加しています:                                                                                     
                                                                                                                                                                                                           
  // jwt-auth.guard.ts で設定                                                                                                                                                                              
  (request as FastifyRequest & { user: JwtPayload }).user = payload;                                                                                                                                       
                                                                                                                                                                                                           
  そのため、後続のガードで user を読み取るには型アサーションが必要になります。                                                                                                                             
                                                                                                                                                                                                           
  図解                                                                                                                                                                                                     
                                                                                                                                                                                                           
  リクエストの流れ:                                                                                                                                                                                        
                                                                                                                                                                                                           
  JwtAuthGuard                    RolesGuard                                                                                                                                                               
       │                              │                                                                                                                                                                    
       │  request.user = payload      │  const user = request.user                                                                                                                                         
       │  (userを追加)                │  (userを読み取り)                                                                                                                                                  
       ▼                              ▼                                                                                                                                                                    
  ┌─────────────┐              ┌─────────────┐                                                                                                                                                             
  │ FastifyReq  │      →       │ FastifyReq  │                                                                                                                                                             
  │ + user      │              │ + user      │                                                                                                                                                             
  └─────────────┘              └─────────────┘          
*/


    if (!user) {
      throw new BusinessException(
        ErrorCodes.TOKEN_MISSING,
        'User not authenticated',
        401,
      );
    }

    const userRoles = this.jwtVerificationService.extractRoles(user);
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new BusinessException(
        ErrorCodes.INSUFFICIENT_PERMISSIONS,
        `Required roles: ${requiredRoles.join(', ')}`,
        403,
      );
    }

    return true;
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import {
  JwtVerificationService,
  IpRestrictionService,
  AuthService,
} from './services';
import { JwtStrategy } from './strategies';
import {
  JwtAuthGuard,
  IpRestrictionGuard,
  RolesGuard,
  ScopesGuard,
} from './guards';
import { RefreshTokenRepository } from './repositories';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';

/**
 * 認証モジュール
 *
 * アプリケーション全体の認証・認可機能を提供するモジュール。
 * このモジュールをインポートすると、以下のグローバルガードが自動的に有効になる:
 *
 * 1. **JwtAuthGuard**: JWTトークンの検証（認証）
 * 2. **IpRestrictionGuard**: IPアドレス制限（認可）
 * 3. **RolesGuard**: ロールベースのアクセス制御（認可）
 * 4. **ScopesGuard**: スコープベースのアクセス制御（認可）
 *
 * ガードは上記の順序で実行され、すべてのガードをパスしたリクエストのみが
 * コントローラーのハンドラーに到達する。
 *
 * @example
 * ```typescript
 * // AppModuleでインポートして使用
 * @Module({
 *   imports: [AuthModule],
 * })
 * export class AppModule {}
 * ```
 *
 * @see JwtAuthGuard - JWT検証の詳細
 * @see IpRestrictionGuard - IP制限の詳細
 * @see RolesGuard - ロール認可の詳細
 * @see ScopesGuard - スコープ認可の詳細
 */
@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
        },
      }),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    JwtVerificationService,
    IpRestrictionService,
    AuthService,
    RefreshTokenRepository,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IpRestrictionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ScopesGuard,
    },
  ],
  exports: [JwtVerificationService, IpRestrictionService, AuthService, PassportModule],
})
export class AuthModule {}

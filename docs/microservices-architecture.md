# マイクロサービスアーキテクチャ設計

## 概要

本ドキュメントは、helplineプロジェクトをマイクロサービスアーキテクチャに拡張する際の設計指針を示す。

**選定技術:**
- 認証認可: AWS Cognito
- サービス間通信: REST（同期通信）

---

## 現状分析

現在のhelplineプロジェクトは既にマイクロサービス化への基盤が整っている：
- JWT検証専用アーキテクチャ（トークン発行は外部に委譲）
- JWKS/Secret方式でのトークン検証
- ロール・スコープベースの認可
- Controller-Service-Repository の3層設計

---

## 1. 全体アーキテクチャ

```
                              ┌─────────────────────────────┐
                              │       AWS Cognito           │
                              │  - User Pool                │
                              │  - App Client               │
                              │  - Groups (roles)           │
                              └──────────────┬──────────────┘
                                             │ JWKS/Token発行
                                             │
┌──────────────┐              ┌──────────────▼──────────────┐
│   クライアント  │◄────────────│        API Gateway          │
│  (SPA/Mobile) │─────────────►│  - JWT検証                  │
└──────────────┘              │  - レート制限                │
                              │  - ルーティング              │
                              └──────────────┬──────────────┘
                                             │
          ┌──────────────────────────────────┼──────────────────────────────────┐
          │                                  │                                  │
┌─────────▼─────────┐          ┌─────────────▼─────────────┐     ┌─────────────▼─────────────┐
│   User Service    │◄────────►│     Order Service         │◄───►│    Product Service        │
│  (現在のhelpline)  │   REST   │                           │ REST│                           │
│                   │          │                           │     │                           │
│  PostgreSQL       │          │  PostgreSQL               │     │  PostgreSQL               │
└───────────────────┘          └───────────────────────────┘     └───────────────────────────┘
```

---

## 2. AWS Cognito 設計

### 2.1 構成

```
AWS Cognito
├── User Pool: helpline-prod
│   ├── App Client: helpline-api (confidential, with secret)
│   ├── App Client: helpline-spa (public, PKCE)
│   ├── Groups
│   │   ├── admin
│   │   ├── manager
│   │   └── user
│   └── Lambda Triggers (オプション)
│       ├── Pre Sign-up: カスタムバリデーション
│       ├── Post Confirmation: User Service連携
│       └── Pre Token Generation: カスタムクレーム追加
└── Identity Pool (オプション: AWS IAMロール紐付け用)
```

### 2.2 環境変数設定

```bash
# helpline側の設定
JWT_JWKS_URI=https://cognito-idp.ap-northeast-1.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json
JWT_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/{USER_POOL_ID}
JWT_AUDIENCE={APP_CLIENT_ID}
JWT_ROLES_CLAIM=cognito:groups
JWT_ALGORITHMS=RS256
```

### 2.3 トークンフロー

```
1. クライアント → Cognito: 認証リクエスト (OAuth 2.0 / OIDC)
2. Cognito → クライアント: ID Token + Access Token + Refresh Token
3. クライアント → API Gateway: API呼び出し (Authorization: Bearer {access_token})
4. API Gateway → 各サービス: トークン検証 + リクエスト転送
```

### 2.4 既存コードとの連携

現在の`JwtVerificationService`はCognitoと互換性あり：
- JWKS URIからの公開鍵取得に対応済み
- `cognito:groups`からのロール抽出に対応済み（設定で指定）

---

## 3. サービス間通信（REST）

### 3.1 通信パターン

```
┌───────────────────┐                    ┌───────────────────┐
│   Order Service   │  GET /users/{id}   │   User Service    │
│                   │ ─────────────────► │                   │
│                   │  Authorization:    │                   │
│                   │  Bearer {token}    │                   │
│                   │ ◄───────────────── │                   │
│                   │  User Response     │                   │
└───────────────────┘                    └───────────────────┘

トークン伝播方式:
1. Token Passthrough: 元のユーザートークンをそのまま転送
2. M2M Token: サービス専用トークンを使用（バックグラウンド処理向け）
```

### 3.2 ServiceHttpClient 実装例

```typescript
// src/common/http/service-http-client.ts
import { Injectable, Scope, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { REQUEST } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable({ scope: Scope.REQUEST })
export class ServiceHttpClient {
  constructor(
    private readonly httpService: HttpService,
    @Inject(REQUEST) private readonly request: FastifyRequest,
  ) {}

  async get<T>(serviceUrl: string, path: string): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.get<T>(`${serviceUrl}${path}`, {
        headers: {
          Authorization: this.request.headers.authorization,
          'X-Correlation-Id':
            (this.request.headers['x-correlation-id'] as string) || randomUUID(),
        },
        timeout: 5000,
      }),
    );
    return response.data;
  }

  async post<T, D>(serviceUrl: string, path: string, data: D): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.post<T>(`${serviceUrl}${path}`, data, {
        headers: {
          Authorization: this.request.headers.authorization,
          'X-Correlation-Id':
            (this.request.headers['x-correlation-id'] as string) || randomUUID(),
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }),
    );
    return response.data;
  }

  async put<T, D>(serviceUrl: string, path: string, data: D): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.put<T>(`${serviceUrl}${path}`, data, {
        headers: {
          Authorization: this.request.headers.authorization,
          'X-Correlation-Id':
            (this.request.headers['x-correlation-id'] as string) || randomUUID(),
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }),
    );
    return response.data;
  }

  async delete<T>(serviceUrl: string, path: string): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.delete<T>(`${serviceUrl}${path}`, {
        headers: {
          Authorization: this.request.headers.authorization,
          'X-Correlation-Id':
            (this.request.headers['x-correlation-id'] as string) || randomUUID(),
        },
        timeout: 5000,
      }),
    );
    return response.data;
  }
}
```

### 3.3 HttpClientModule 実装例

```typescript
// src/common/http/http-client.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ServiceHttpClient } from './service-http-client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [ServiceHttpClient],
  exports: [ServiceHttpClient, HttpModule],
})
export class HttpClientModule {}
```

### 3.4 使用例

```typescript
// orders.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ServiceHttpClient } from '../common/http/service-http-client';

interface User {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly httpClient: ServiceHttpClient,
    @Inject('USER_SERVICE_URL') private readonly userServiceUrl: string,
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string): Promise<Order> {
    // ユーザー情報を取得（トークンは自動的に伝播）
    const user = await this.httpClient.get<User>(
      this.userServiceUrl,
      `/users/${userId}`,
    );

    // 注文を作成
    return this.orderRepository.create({
      ...dto,
      userId: user.id,
      userName: user.name,
    });
  }
}
```

---

## 4. M2M（サービス間）認証

バックグラウンド処理など、ユーザーコンテキストがない通信向け。

### 4.1 フロー

```
┌───────────────┐  ①Client Credentials  ┌───────────────┐
│ Order Service │ ────────────────────► │  AWS Cognito  │
│               │  client_id/secret     │               │
│               │ ◄──────────────────── │               │
│               │  ②M2Mトークン          │               │
└───────┬───────┘                       └───────────────┘
        │ ③API呼び出し (Authorization: Bearer {m2m-token})
        ▼
┌───────────────┐
│ User Service  │  scope検証: service:user:read
└───────────────┘
```

### 4.2 M2MTokenService 実装例

```typescript
// src/common/auth/m2m-token.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class M2MTokenService {
  private readonly logger = new Logger(M2MTokenService.name);
  private tokenCache: TokenCache | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getServiceToken(): Promise<string> {
    // キャッシュが有効な場合はそれを返す（有効期限の1分前まで）
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60000) {
      return this.tokenCache.token;
    }

    this.logger.debug('Fetching new M2M token from Cognito');

    const tokenUrl = this.configService.get<string>('COGNITO_TOKEN_URL');
    const clientId = this.configService.get<string>('SERVICE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('SERVICE_CLIENT_SECRET');
    const scope = this.configService.get<string>('SERVICE_SCOPE', 'service/user.read');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await firstValueFrom(
        this.httpService.post<TokenResponse>(
          tokenUrl,
          new URLSearchParams({
            grant_type: 'client_credentials',
            scope,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${credentials}`,
            },
          },
        ),
      );

      this.tokenCache = {
        token: response.data.access_token,
        expiresAt: Date.now() + response.data.expires_in * 1000,
      };

      this.logger.debug('M2M token fetched and cached successfully');
      return this.tokenCache.token;
    } catch (error) {
      this.logger.error('Failed to fetch M2M token', error);
      throw error;
    }
  }

  clearCache(): void {
    this.tokenCache = null;
  }
}
```

### 4.3 M2M環境変数

```bash
# M2M認証用の設定
COGNITO_TOKEN_URL=https://your-domain.auth.ap-northeast-1.amazoncognito.com/oauth2/token
SERVICE_CLIENT_ID=your-service-client-id
SERVICE_CLIENT_SECRET=your-service-client-secret
SERVICE_SCOPE=service/user.read service/order.write
```

---

## 5. 相関ID（Correlation ID）伝播

分散トレーシングのための相関ID管理。

### 5.1 Interceptor 実装例

```typescript
// src/common/interceptors/correlation-id.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    // 既存の相関IDを取得、なければ新規生成
    const correlationId =
      (request.headers[CORRELATION_ID_HEADER] as string) || randomUUID();

    // リクエストヘッダーに設定（サービス間で伝播可能に）
    (request.headers as Record<string, string>)[CORRELATION_ID_HEADER] =
      correlationId;

    // レスポンスヘッダーにも設定
    response.header(CORRELATION_ID_HEADER, correlationId);

    return next.handle();
  }
}
```

### 5.2 グローバル登録

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
  ],
})
export class AppModule {}
```

---

## 6. エラーハンドリング

### 6.1 サービス間通信エラー

```typescript
// src/common/http/service-http-client.ts (エラーハンドリング追加版)
import {
  Injectable,
  Scope,
  Inject,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { AxiosError } from 'axios';

@Injectable({ scope: Scope.REQUEST })
export class ServiceHttpClient {
  // ... 既存のコード

  private handleError(error: AxiosError, serviceName: string): never {
    if (error.response) {
      const status = error.response.status;
      const message = (error.response.data as { message?: string })?.message;

      switch (status) {
        case 400:
          throw new BadRequestException(message || 'Bad request to service');
        case 401:
        case 403:
          throw new ForbiddenException(
            message || `Authorization failed for ${serviceName}`,
          );
        case 404:
          throw new NotFoundException(
            message || `Resource not found in ${serviceName}`,
          );
        default:
          throw new ServiceUnavailableException(
            `${serviceName} returned error: ${status}`,
          );
      }
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw new ServiceUnavailableException(`${serviceName} is unavailable`);
    }

    throw new ServiceUnavailableException(`Failed to connect to ${serviceName}`);
  }

  async get<T>(serviceUrl: string, path: string): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(`${serviceUrl}${path}`, {
          headers: this.getHeaders(),
          timeout: 5000,
        }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError, this.extractServiceName(serviceUrl));
    }
  }

  private extractServiceName(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown-service';
    }
  }
}
```

---

## 7. APIゲートウェイ

### 7.1 推奨: AWS API Gateway

Cognitoとの親和性が高く、マネージドで運用負荷が低い。

```
┌──────────────┐     ┌─────────────────────────────────────┐
│   クライアント  │────►│          AWS API Gateway            │
└──────────────┘     │                                     │
                     │  ┌─────────────────────────────────┐│
                     │  │ Cognito Authorizer              ││
                     │  │ - JWT自動検証                    ││
                     │  │ - cognito:groups をコンテキストへ ││
                     │  └─────────────────────────────────┘│
                     │                                     │
                     │  Routes:                            │
                     │  /users/*    → User Service (ALB)   │
                     │  /orders/*   → Order Service (ALB)  │
                     │  /products/* → Product Service (ALB)│
                     └─────────────────────────────────────┘
```

### 7.2 機能一覧

| 機能 | 実装方法 |
|------|---------|
| JWT検証 | Cognito Authorizer |
| レート制限 | Usage Plans + API Keys |
| ルーティング | Integration設定 |
| CORS | Gateway Response設定 |
| ログ | CloudWatch Logs |
| 監視 | CloudWatch Metrics |

### 7.3 代替案: NestJS Gateway

より柔軟なカスタマイズが必要な場合。

```typescript
// apps/api-gateway/src/proxy/proxy.controller.ts
import { All, Controller, Req, Res } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('users/*')
  async proxyToUserService(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    return this.proxyService.forward(req, res, 'USER_SERVICE_URL');
  }

  @All('orders/*')
  async proxyToOrderService(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    return this.proxyService.forward(req, res, 'ORDER_SERVICE_URL');
  }

  @All('products/*')
  async proxyToProductService(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    return this.proxyService.forward(req, res, 'PRODUCT_SERVICE_URL');
  }
}
```

---

## 8. 実装ロードマップ

### Phase 1: AWS Cognito セットアップ
- [ ] User Pool 作成
- [ ] App Client 設定（SPA用: public/PKCE, API用: confidential）
- [ ] Groups 作成（admin, manager, user）
- [ ] helpline の環境変数設定（JWT_JWKS_URI, JWT_ISSUER等）

### Phase 2: サービス間通信基盤
- [ ] @nestjs/axios インストール
- [ ] ServiceHttpClient モジュール実装
- [ ] M2MTokenService 実装
- [ ] 相関ID（X-Correlation-Id）伝播
- [ ] エラーハンドリング統一

### Phase 3: APIゲートウェイ
- [ ] AWS API Gateway 構築
- [ ] Cognito Authorizer 設定
- [ ] ルーティング設定
- [ ] Usage Plans（レート制限）設定

### Phase 4: 新サービス追加時
- [ ] 共通認証モジュールを npm パッケージ化（オプション）
- [ ] サービス固有のDB設計
- [ ] API Gateway にルート追加
- [ ] M2M用 App Client・スコープ設定

---

## 9. ファイル構成

### 新規作成ファイル

```
src/
├── common/
│   ├── http/
│   │   ├── service-http-client.ts      # サービス間HTTPクライアント
│   │   ├── http-client.module.ts       # HTTPモジュール
│   │   └── index.ts                    # バレルエクスポート
│   ├── auth/
│   │   ├── m2m-token.service.ts        # M2Mトークン取得
│   │   └── index.ts                    # バレルエクスポート
│   └── interceptors/
│       ├── correlation-id.interceptor.ts  # 相関ID伝播
│       └── index.ts                    # バレルエクスポート
```

### 既存ファイル変更

| ファイル | 変更内容 |
|---------|---------|
| `src/app.module.ts` | HttpClientModule, CorrelationIdInterceptor 追加 |
| `src/auth/auth.module.ts` | M2MTokenService 追加（オプション） |
| `.env` | 新しい環境変数追加 |

---

## 10. 環境変数一覧

```bash
# ===================
# JWT検証設定（Cognito用）
# ===================
JWT_JWKS_URI=https://cognito-idp.ap-northeast-1.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json
JWT_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/{USER_POOL_ID}
JWT_AUDIENCE={APP_CLIENT_ID}
JWT_ROLES_CLAIM=cognito:groups
JWT_SCOPES_CLAIM=scope
JWT_ALGORITHMS=RS256

# ===================
# M2M認証設定
# ===================
COGNITO_TOKEN_URL=https://your-domain.auth.ap-northeast-1.amazoncognito.com/oauth2/token
SERVICE_CLIENT_ID=your-service-client-id
SERVICE_CLIENT_SECRET=your-service-client-secret
SERVICE_SCOPE=service/user.read

# ===================
# サービスURL設定
# ===================
USER_SERVICE_URL=http://user-service:3000
ORDER_SERVICE_URL=http://order-service:3001
PRODUCT_SERVICE_URL=http://product-service:3002
```

---

## 11. セキュリティ考慮事項

### 11.1 トークン管理
- M2Mトークンはメモリキャッシュし、有効期限前に更新
- シークレットは環境変数またはSecrets Managerで管理
- トークンログ出力時はマスキング

### 11.2 通信セキュリティ
- サービス間通信はVPC内で完結
- 外部からのアクセスはAPI Gateway経由のみ
- TLS 1.2以上を使用

### 11.3 認可
- スコープベースのアクセス制御
- 最小権限の原則に従ったスコープ設計
- M2M用スコープはサービス専用に限定

---

## 12. 参考リンク

- [AWS Cognito Developer Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/)
- [NestJS HTTP Module](https://docs.nestjs.com/techniques/http-module)
- [OAuth 2.0 Client Credentials Grant](https://oauth.net/2/grant-types/client-credentials/)

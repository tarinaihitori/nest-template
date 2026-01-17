# 認証機能ドキュメント

## 概要

このAPIは外部認証サーバー（Keycloak、AWS Cognito等）で発行されたJWTトークンを検証します。トークンの発行は行わず、検証のみを担当します。

### JWT検証の仕組み

JWTトークンの検証には2つの方式をサポートしています：

1. **JWKS（JSON Web Key Set）方式**: 非対称鍵（RS256等）を使用。認証サーバーの公開鍵エンドポイントから鍵を取得して検証
2. **対称鍵方式**: 共有シークレット（HS256等）を使用。事前に共有された秘密鍵で検証

## アーキテクチャ

```
[クライアント] → [認証サーバー] → JWTトークン取得
      ↓
[クライアント] → [このAPI] → JWTトークン検証 → リソースアクセス
```

クライアントは認証サーバーで認証を行い、取得したJWTトークンをこのAPIへのリクエストに含めます。このAPIはトークンの有効性を検証し、正当なリクエストのみを処理します。

## コンポーネント構成

```
src/auth/
├── auth.module.ts              # 認証モジュール
├── services/
│   └── jwt-verification.service.ts  # JWT検証サービス
├── guards/
│   ├── jwt-auth.guard.ts       # 認証ガード
│   └── roles.guard.ts          # 認可ガード
├── decorators/
│   ├── public.decorator.ts     # 公開エンドポイント用デコレータ
│   ├── roles.decorator.ts      # ロール指定デコレータ
│   └── current-user.decorator.ts  # 現在のユーザー取得デコレータ
└── interfaces/
    ├── jwt-payload.interface.ts   # JWTペイロード型定義
    └── auth-config.interface.ts   # 認証設定型定義
```

### コンポーネント説明

| コンポーネント | 説明 |
|--------------|------|
| `AuthModule` | 認証関連のすべてのコンポーネントを管理するモジュール |
| `JwtVerificationService` | JWTトークンの検証を行うサービス |
| `JwtAuthGuard` | リクエストの認証を行うガード |
| `RolesGuard` | ロールベースのアクセス制御を行うガード |
| `@Public` | 認証をスキップするエンドポイントに使用 |
| `@Roles` | 必要なロールを指定するデコレータ |
| `@CurrentUser` | 現在のユーザー情報を取得するデコレータ |

## 設定方法

### JWKS方式（Keycloak、Cognito等）

JWKS URIを指定して、認証サーバーの公開鍵エンドポイントから自動的に鍵を取得します。

```bash
# Keycloakの例
JWT_JWKS_URI=https://keycloak.example.com/realms/myrealm/protocol/openid-connect/certs

# AWS Cognitoの例
JWT_JWKS_URI=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_XXXXXX/.well-known/jwks.json
```

### 対称鍵方式

共有シークレットを指定して検証します。

```bash
JWT_SECRET=your-256-bit-secret-key-here
```

> **注意**: `JWT_JWKS_URI`と`JWT_SECRET`の両方が設定されている場合、`JWT_JWKS_URI`が優先されます。

## 環境変数

| 変数名 | 必須 | 説明 | 例 |
|-------|------|------|-----|
| `JWT_JWKS_URI` | ※1 | JWKSエンドポイントURL | `https://auth.example.com/.well-known/jwks.json` |
| `JWT_SECRET` | ※1 | 対称鍵シークレット | `your-secret-key` |
| `JWT_ISSUER` | No | 発行者検証（カンマ区切りで複数指定可） | `https://auth.example.com` |
| `JWT_AUDIENCE` | No | オーディエンス検証（カンマ区切りで複数指定可） | `my-api` |
| `JWT_ALGORITHMS` | No | 許可するアルゴリズム（デフォルト: `RS256,HS256`） | `RS256,RS384,RS512` |
| `JWT_ROLES_CLAIM` | No | ロール情報のクレームパス（デフォルト: `roles`） | `realm_access.roles` |

※1: `JWT_JWKS_URI`または`JWT_SECRET`のいずれかが必須

### プロバイダ別ロールクレーム設定例

```bash
# Keycloak（レルムロール）
JWT_ROLES_CLAIM=realm_access.roles

# Keycloak（クライアントロール）
JWT_ROLES_CLAIM=resource_access.my-client.roles

# AWS Cognito
JWT_ROLES_CLAIM=cognito:groups

# カスタム
JWT_ROLES_CLAIM=roles
```

## エラーコード

| エラーコード | HTTPステータス | 説明 |
|-------------|---------------|------|
| `TOKEN_MISSING` | 401 | Authorizationヘッダーにトークンが提供されていない |
| `TOKEN_INVALID` | 401 | トークンが無効（署名不正、フォーマット不正等） |
| `TOKEN_EXPIRED` | 401 | トークンの有効期限が切れている |
| `INSUFFICIENT_PERMISSIONS` | 403 | 要求されたリソースへのアクセス権限がない |

### エラーレスポンス例

```json
{
  "statusCode": 401,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/users",
  "method": "GET",
  "message": "Token has expired",
  "errorCode": "TOKEN_EXPIRED"
}
```

## 使用例

### 基本的な使用

デフォルトでは、すべてのエンドポイントは認証が必要です。

```typescript
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('profile')
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: JwtPayload) {
    return { userId: user.sub, email: user.email };
  }
}
```

### 公開エンドポイント

認証をスキップする場合は`@Public()`デコレータを使用します。

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

### ロールベースアクセス制御

特定のロールが必要なエンドポイントには`@Roles()`デコレータを使用します。

```typescript
import { Controller, Get, Post, Delete } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
export class AdminController {
  @Get('users')
  @Roles('admin')
  listUsers() {
    // adminロールを持つユーザーのみアクセス可能
    return [];
  }

  @Delete('users/:id')
  @Roles('admin', 'super-admin')
  deleteUser() {
    // adminまたはsuper-adminロールを持つユーザーがアクセス可能
    return { deleted: true };
  }
}
```

### コントローラーレベルでのロール指定

コントローラー全体に対してロールを指定することもできます。

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('management')
@Roles('manager')
export class ManagementController {
  @Get('reports')
  getReports() {
    // managerロールが必要
    return [];
  }

  @Post('reports')
  @Roles('admin') // メソッドレベルで上書き
  createReport() {
    // adminロールが必要（managerではアクセス不可）
    return {};
  }
}
```

## Keycloak設定例

### 1. レルム作成とクライアント設定

1. Keycloakでレルムを作成
2. クライアントを作成（Access Type: confidential or public）
3. ユーザーを作成し、ロールを割り当て

### 2. 環境変数設定

```bash
JWT_JWKS_URI=https://keycloak.example.com/realms/myrealm/protocol/openid-connect/certs
JWT_ISSUER=https://keycloak.example.com/realms/myrealm
JWT_AUDIENCE=account
JWT_ROLES_CLAIM=realm_access.roles
```

## AWS Cognito設定例

### 1. ユーザープール作成

1. AWS Cognitoでユーザープールを作成
2. アプリクライアントを作成
3. グループを作成し、ユーザーを割り当て

### 2. 環境変数設定

```bash
JWT_JWKS_URI=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_XXXXXXX/.well-known/jwks.json
JWT_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_XXXXXXX
JWT_AUDIENCE=your-app-client-id
JWT_ROLES_CLAIM=cognito:groups
```

## セキュリティ考慮事項

1. **HTTPS必須**: 本番環境では必ずHTTPSを使用してください
2. **シークレット管理**: `JWT_SECRET`は安全に管理し、バージョン管理に含めないでください
3. **トークン有効期限**: 認証サーバー側で適切な有効期限を設定してください
4. **アルゴリズム制限**: 使用するアルゴリズムを明示的に指定し、`none`アルゴリズムを許可しないでください
5. **Issuer/Audience検証**: 可能な限り`JWT_ISSUER`と`JWT_AUDIENCE`を設定し、トークンの出所を検証してください

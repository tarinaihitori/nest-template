# エラーハンドリング設計書

## 概要

本プロジェクトでは、統一されたエラーレスポンス形式とグローバル例外フィルターを使用して、一貫性のあるエラーハンドリングを実現しています。

## エラーレスポンス形式

すべてのエラーは以下の形式で返却されます:

```json
{
  "statusCode": 404,
  "timestamp": "2026-01-16T15:30:00.000Z",
  "path": "/users/nonexistent1234567",
  "method": "GET",
  "message": "User with ID nonexistent1234567 not found",
  "errorCode": "USER_NOT_FOUND",
  "errors": [],
  "stack": "Error: ..."
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `statusCode` | number | HTTPステータスコード |
| `timestamp` | string | エラー発生時刻 (ISO 8601形式) |
| `path` | string | リクエストパス |
| `method` | string | HTTPメソッド |
| `message` | string | エラーメッセージ |
| `errorCode` | string | アプリケーション固有のエラーコード |
| `errors` | array | バリデーションエラーの詳細 (バリデーションエラー時のみ) |
| `stack` | string | スタックトレース (開発環境のみ) |

## エラーコード一覧

### HTTPエラー

| エラーコード | HTTPステータス | 説明 |
|-------------|---------------|------|
| `BAD_REQUEST` | 400 | 不正なリクエスト |
| `UNAUTHORIZED` | 401 | 認証エラー |
| `FORBIDDEN` | 403 | アクセス拒否 |
| `NOT_FOUND` | 404 | リソース未発見 |
| `CONFLICT` | 409 | 競合エラー |
| `INTERNAL_SERVER_ERROR` | 500 | サーバー内部エラー |

### バリデーションエラー

| エラーコード | HTTPステータス | 説明 |
|-------------|---------------|------|
| `VALIDATION_ERROR` | 400 | 入力値バリデーションエラー |

### Prismaエラー

| エラーコード | HTTPステータス | Prismaコード | 説明 |
|-------------|---------------|-------------|------|
| `UNIQUE_CONSTRAINT_VIOLATION` | 409 | P2002 | ユニーク制約違反 |
| `FOREIGN_KEY_VIOLATION` | 400 | P2003 | 外部キー制約違反 |
| `RECORD_NOT_FOUND` | 404 | P2025 | レコード未発見 |

### ビジネスロジックエラー

| エラーコード | HTTPステータス | 説明 |
|-------------|---------------|------|
| `USER_NOT_FOUND` | 404 | ユーザーが見つからない |

## 使用方法

### 1. BusinessException の使用

サービス層でビジネスロジックエラーを投げる場合:

```typescript
import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception';
import { ErrorCodes } from '../common/constants/error-codes.constant';

// ユーザーが見つからない場合
if (!user) {
  throw new BusinessException(
    ErrorCodes.USER_NOT_FOUND,
    `User with ID ${id} not found`,
    HttpStatus.NOT_FOUND,
  );
}
```

### 2. DTOバリデーション

DTOにバリデーションデコレータを追加することで、自動的にバリデーションエラーが処理されます:

```typescript
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'name must be at most 100 characters' })
  name?: string;
}
```

### 3. 新しいエラーコードの追加

`src/common/constants/error-codes.constant.ts` に新しいエラーコードを追加:

```typescript
export const ErrorCodes = {
  // 既存のコード...

  // 新しいビジネスロジックエラー
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
} as const;
```

## アーキテクチャ

```
リクエスト
    ↓
┌─────────────────────────────────────┐
│         ValidationPipe              │ ← DTOバリデーション
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│          Controller                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│           Service                   │ ← BusinessException
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│          Repository                 │ ← Prismaエラー
└─────────────────────────────────────┘
    ↓
例外発生時
    ↓
┌─────────────────────────────────────┐
│      AllExceptionsFilter            │ ← 全例外をキャッチ
│  ┌─────────────────────────────┐    │
│  │ isPrismaKnownError()       │    │ Prismaエラー判定
│  │ mapPrismaError()           │    │ エラーマッピング
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
    ↓
統一エラーレスポンス
```

## ファイル構成

```
src/common/
├── constants/
│   └── error-codes.constant.ts    # エラーコード定義
├── interfaces/
│   └── error-response.interface.ts # レスポンス型定義
├── exceptions/
│   └── business.exception.ts      # カスタム例外クラス
├── utils/
│   └── error-mapper.util.ts       # Prismaエラーマッパー
└── filters/
    ├── all-exceptions.filter.ts   # グローバル例外フィルター
    └── all-exceptions.filter.spec.ts # テスト
```

## エラーレスポンス例

### バリデーションエラー (400)

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid"}'
```

```json
{
  "statusCode": 400,
  "timestamp": "2026-01-16T15:30:00.000Z",
  "path": "/users",
  "method": "POST",
  "message": "Validation failed",
  "errorCode": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "email must be a valid email address"
    }
  ]
}
```

### リソース未発見 (404)

```bash
curl http://localhost:3000/users/nonexistent1234567
```

```json
{
  "statusCode": 404,
  "timestamp": "2026-01-16T15:30:00.000Z",
  "path": "/users/nonexistent1234567",
  "method": "GET",
  "message": "User with ID nonexistent1234567 not found",
  "errorCode": "USER_NOT_FOUND"
}
```

### ユニーク制約違反 (409)

```bash
# 同じemailで2回作成
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

```json
{
  "statusCode": 409,
  "timestamp": "2026-01-16T15:30:00.000Z",
  "path": "/users",
  "method": "POST",
  "message": "Unique constraint violation on field(s): email",
  "errorCode": "UNIQUE_CONSTRAINT_VIOLATION"
}
```

## 環境による動作の違い

| 項目 | 開発環境 | 本番環境 |
|-----|---------|---------|
| スタックトレース | 含む | 含まない |
| 詳細エラーメッセージ | 含む | 汎用メッセージ |
| ログレベル | DEBUG以上 | WARN以上 |

環境は `NODE_ENV` 環境変数で制御されます:
- `NODE_ENV !== 'production'`: 開発環境
- `NODE_ENV === 'production'`: 本番環境

## ログ出力

例外フィルターは以下の形式でログを出力します:

```
[METHOD] /path - STATUS_CODE ERROR_CODE: message
```

- 500番台エラー: `ERROR` レベル (スタックトレース付き)
- 400番台エラー: `WARN` レベル

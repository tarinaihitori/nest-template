# ログ設計ドキュメント

## 概要

本プロジェクトでは、NestJS + Fastify アプリケーションに Pino を使用した構造化ログを実装しています。

| 項目 | 選定 |
|------|------|
| ログライブラリ | Pino (nestjs-pino) |
| ログ形式 | JSON (本番) / Pretty (開発) |
| ログレベル制御 | 環境変数 `LOG_LEVEL` |
| HTTPログ | pino-http による自動記録 |
| 相関ID | `x-correlation-id` ヘッダー or UUID自動生成 |

---

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `LOG_LEVEL` | ログレベル (trace/debug/info/warn/error/fatal) | 開発: `debug`, 本番: `info` |
| `SERVICE_NAME` | サービス名 (ログに含まれる) | `nest-project` |
| `NODE_ENV` | 環境識別 | - |
| `APP_VERSION` | アプリケーションバージョン | `0.0.1` |

```env
# .env
LOG_LEVEL=debug
SERVICE_NAME=nest-project
APP_VERSION=0.0.1
```

---

## ログレベル

| レベル | 値 | 用途 |
|--------|-----|------|
| fatal | 60 | アプリケーションクラッシュ |
| error | 50 | エラー状態 |
| warn | 40 | 警告 |
| info | 30 | 通常の重要イベント (本番デフォルト) |
| debug | 20 | デバッグ情報 (開発デフォルト) |
| trace | 10 | 詳細トレース |

---

## 出力例

### 開発環境 (pino-pretty)

```
[2024-01-15 10:30:45.123] INFO: GET /api/users completed
    req: {"method":"GET","url":"/api/users"}
    res: {"statusCode":200}
    responseTime: 45ms
    reqId: "550e8400-e29b-41d4-a716-446655440000"
```

### 本番環境 (JSON)

```json
{
  "level": "INFO",
  "timestamp": "2024-01-17T10:30:45.123Z",
  "service": "nest-project",
  "environment": "production",
  "version": "0.0.1",
  "reqId": "550e8400-e29b-41d4-a716-446655440000",
  "req": {"method": "GET", "url": "/api/users"},
  "res": {"statusCode": 200},
  "responseTime": 45,
  "message": "GET /api/users completed"
}
```

---

## ディレクトリ構成

```
src/common/
├── logger/
│   ├── logger.module.ts    # Pinoロガー設定モジュール
│   └── index.ts            # エクスポート
├── filters/
│   └── all-exceptions.filter.ts  # PinoLogger使用
└── ...

src/auth/
└── guards/
    └── jwt-auth.guard.ts   # PinoLogger使用
```

---

## 使用方法

### サービス層でのログ使用

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class UsersService {
  constructor(
    @InjectPinoLogger(UsersService.name)
    private readonly logger: PinoLogger,
  ) {}

  async findUser(id: string) {
    this.logger.info({ userId: id }, 'Finding user');
    // ...
    this.logger.debug({ userId: id, result: user }, 'User found');
    return user;
  }

  async createUser(data: CreateUserDto) {
    try {
      const user = await this.repository.create(data);
      this.logger.info({ userId: user.id }, 'User created successfully');
      return user;
    } catch (error) {
      this.logger.error({ err: error, data }, 'Failed to create user');
      throw error;
    }
  }
}
```

### コントローラーでのログ使用

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Controller('users')
export class UsersController {
  constructor(
    @InjectPinoLogger(UsersController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    this.logger.info({ userId: id }, 'Getting user by ID');
    // ...
  }
}
```

### ログメソッドのシグネチャ

```typescript
// オブジェクト + メッセージ
this.logger.info({ key: 'value' }, 'Log message');

// エラーログ (err プロパティを使用)
this.logger.error({ err: error, context: 'additional' }, 'Error occurred');

// メッセージのみ
this.logger.info('Simple message');
```

---

## HTTPリクエストログ

pino-http により、すべてのHTTPリクエストは自動的にログに記録されます。

### 自動記録される情報

| フィールド | 説明 |
|-----------|------|
| `reqId` | リクエストID (相関ID) |
| `req.method` | HTTPメソッド |
| `req.url` | リクエストURL |
| `req.headers.host` | ホストヘッダー |
| `req.headers.user-agent` | User-Agent |
| `res.statusCode` | レスポンスステータスコード |
| `responseTime` | レスポンス時間 (ms) |

### ログレベルの自動判定

| 条件 | ログレベル |
|------|----------|
| ステータスコード >= 500 またはエラー | `error` |
| ステータスコード >= 400 | `warn` |
| その他 | `info` |

---

## 相関ID (Correlation ID)

リクエストの追跡のため、各リクエストに一意のIDが付与されます。

### 動作

1. `x-correlation-id` ヘッダーが存在する場合はその値を使用
2. ヘッダーがない場合は UUID を自動生成

### 使用例

```bash
# 相関IDを指定してリクエスト
curl -H "x-correlation-id: my-trace-id-123" http://localhost:3000/api/users

# ログ出力
# {"reqId":"my-trace-id-123", ...}
```

---

## セキュリティ

### 機密情報のマスキング

以下のフィールドは自動的にマスキングされます：

- `req.headers.authorization`
- `req.headers.cookie`

```json
{
  "req": {
    "headers": {
      "authorization": "[Redacted]",
      "cookie": "[Redacted]"
    }
  }
}
```

---

## 設定ファイル

### LoggerModule (`src/common/logger/logger.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const logLevel =
          configService.get('LOG_LEVEL') || (isProduction ? 'info' : 'debug');

        return {
          pinoHttp: {
            level: logLevel,
            genReqId: (req) =>
              (req.headers['x-correlation-id'] as string) || randomUUID(),
            customLogLevel: (_req, res, err) => {
              if (res.statusCode >= 500 || err) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            serializers: {
              req: (req) => ({
                method: req.method,
                url: req.url,
                headers: {
                  host: req.headers.host,
                  'user-agent': req.headers['user-agent'],
                },
              }),
              res: (res) => ({ statusCode: res.statusCode }),
            },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                },
            base: {
              service: configService.get('SERVICE_NAME') || 'nest-project',
            },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
```

---

## テストでのモック

### ユニットテスト

```typescript
import { PinoLogger } from 'nestjs-pino';

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
} as unknown as PinoLogger;

// 使用例
const service = new MyService(mockLogger);
```

### E2Eテスト

```typescript
import { getLoggerToken, LoggerModule } from 'nestjs-pino';

const moduleFixture = await Test.createTestingModule({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { level: 'silent' },
    }),
  ],
  providers: [
    {
      provide: getLoggerToken(MyService.name),
      useValue: mockLogger,
    },
  ],
}).compile();
```

---

## 検証方法

```bash
# 開発モードで起動 (pretty出力)
pnpm run start:dev

# リクエストログ確認
curl http://localhost:3000/

# エラーログ確認
curl http://localhost:3000/nonexistent

# ログレベル変更
LOG_LEVEL=trace pnpm run start:dev

# 本番モードでJSON出力確認
NODE_ENV=production pnpm run start:prod
```

---

## パッケージ

```json
{
  "dependencies": {
    "nestjs-pino": "^4.5.0",
    "pino": "^10.2.0",
    "pino-http": "^11.0.0",
    "pino-pretty": "^13.1.3"
  }
}
```

---

## AWS CloudWatch Logs Insights

### 概要

本プロジェクトのログ出力は、AWS CloudWatch Logs Insightsで効率的に検索・分析できるよう最適化されています。

| 項目 | 形式 | 説明 |
|------|------|------|
| `level` | 文字列 (`INFO`, `ERROR`等) | クエリしやすい形式 |
| `timestamp` | ISO 8601 (`2024-01-17T10:30:45.123Z`) | CloudWatch推奨形式 |
| `message` | 文字列 | CloudWatch標準フィールド名 |
| `environment` | 文字列 | マルチ環境でのフィルタリング用 |
| `version` | 文字列 | アプリケーションバージョン |

### X-Ray統合

AWS X-Rayとの統合により、分散トレーシングが可能です。

#### X-Rayヘッダーからの自動抽出

リクエストに `x-amzn-trace-id` ヘッダーが含まれている場合、以下の情報がログに自動追加されます：

```json
{
  "reqId": "1-678ab123-abc123def456",
  "xray_root": "1-678ab123-abc123def456",
  "xray_parent": "53995c3f42cd8ad8",
  "xray_sampled": "1"
}
```

#### 相関ID優先順位

1. `x-correlation-id` ヘッダーが存在する場合はその値を使用
2. `x-amzn-trace-id` ヘッダーの `Root` 値を使用
3. どちらもない場合は UUID を自動生成

### CloudWatch Logs Insights クエリ例

#### エラーログ検索

```
fields timestamp, level, service, message, reqId
| filter level = "ERROR"
| sort timestamp desc
```

#### 特定リクエストの追跡

```
fields timestamp, level, message
| filter reqId = "550e8400-e29b-41d4-a716-446655440000"
| sort timestamp asc
```

#### X-Rayトレースでの追跡

```
fields timestamp, level, message
| filter xray_root = "1-678ab123-abc123def456"
| sort timestamp asc
```

#### 環境別のログフィルタリング

```
fields timestamp, level, message
| filter environment = "production"
| filter level in ["ERROR", "WARN"]
| sort timestamp desc
```

#### レスポンス時間分析

```
fields timestamp, req.url, responseTime
| stats avg(responseTime), max(responseTime) by req.url
```

#### バージョン別エラー率

```
fields version
| filter level = "ERROR"
| stats count(*) as error_count by version
```

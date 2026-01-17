# ヘルスチェック API

## 概要

ALB (Application Load Balancer) 用のヘルスチェックエンドポイントを提供します。

---

## エンドポイント

| エンドポイント | メソッド | 説明 | 認証 |
|---------------|---------|------|------|
| `/health` | GET | 完全なヘルスチェック (DB接続含む) | 不要 |
| `/health/live` | GET | 簡易ライブネスチェック | 不要 |

---

## /health - 完全ヘルスチェック

アプリケーションとデータベースの状態を確認します。

### レスポンス

#### 正常時 (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "uptime": 3600.5,
  "checks": {
    "database": {
      "status": "up",
      "responseTime": 5
    }
  }
}
```

#### 異常時 (503 Service Unavailable)

```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "uptime": 3600.5,
  "checks": {
    "database": {
      "status": "down"
    }
  }
}
```

### フィールド説明

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `status` | string | `healthy` または `unhealthy` |
| `timestamp` | string | ISO 8601 形式のタイムスタンプ |
| `uptime` | number | アプリケーション起動からの秒数 |
| `checks.database.status` | string | `up` または `down` |
| `checks.database.responseTime` | number | データベース応答時間 (ms) |

---

## /health/live - ライブネスチェック

アプリケーションが起動しているかのみを確認する軽量なエンドポイントです。

### レスポンス (200 OK)

```json
{
  "status": "ok"
}
```

---

## ALB 設定例

### ターゲットグループ ヘルスチェック設定

| 設定項目 | 推奨値 | 説明 |
|---------|--------|------|
| プロトコル | HTTP | |
| パス | `/health` | 完全チェック、または `/health/live` |
| ポート | トラフィックポート | アプリケーションポート |
| 正常のしきい値 | 2 | 連続成功回数 |
| 非正常のしきい値 | 3 | 連続失敗回数 |
| タイムアウト | 5秒 | |
| 間隔 | 30秒 | |
| 成功コード | 200 | |

### 使い分け

| ユースケース | エンドポイント |
|-------------|---------------|
| ALB ヘルスチェック (推奨) | `/health` |
| Kubernetes Liveness Probe | `/health/live` |
| Kubernetes Readiness Probe | `/health` |

---

## ディレクトリ構成

```
src/health/
├── health.module.ts          # モジュール定義
├── health.controller.ts      # エンドポイント定義
├── health.service.ts         # ヘルスチェックロジック
├── health.controller.spec.ts # コントローラーテスト
├── health.service.spec.ts    # サービステスト
└── index.ts                  # エクスポート
```

---

## 検証方法

```bash
# 完全ヘルスチェック
curl http://localhost:3000/health

# ライブネスチェック
curl http://localhost:3000/health/live

# ステータスコード確認
curl -w "%{http_code}" http://localhost:3000/health
```

---

## 拡張

追加のヘルスチェック項目を追加する場合は、`HealthService` を拡張します。

```typescript
// 例: Redis チェックの追加
private async checkRedis(): Promise<{ status: 'up' | 'down'; responseTime?: number }> {
  const start = Date.now();
  try {
    await this.redis.ping();
    return { status: 'up', responseTime: Date.now() - start };
  } catch {
    return { status: 'down' };
  }
}

async check(): Promise<HealthCheckResult> {
  // ...
  const redisCheck = await this.checkRedis();

  return {
    // ...
    checks: {
      database: databaseCheck,
      redis: redisCheck,  // 追加
    },
  };
}
```

# helpline

NestJS + Fastify + Prisma を使った REST API バックエンドプロジェクト

## 技術スタック

- NestJS 11.x
- Fastify 5.x
- TypeScript 5.7+
- Prisma ORM
- PostgreSQL 17.4
- pnpm
- Vitest（テスト）

## フォルダ構成

```
/workspace/
├── .devcontainer/          # 開発コンテナ設定
│   ├── devcontainer.json   # Dev Container設定
│   ├── compose.yaml        # Docker Compose設定
│   └── Dockerfile          # 開発環境用Dockerfile
├── docker/                 # 環境別Docker設定
│   ├── prd/                # 本番環境
│   └── stg/                # ステージング環境
├── src/                    # ソースコード
│   ├── common/             # 共通ユーティリティ（例外フィルター等）
│   ├── prisma/             # Prismaサービス（DB接続）
│   └── users/              # ユーザーモジュール
├── test/                   # E2Eテスト
├── prisma/                 # Prismaスキーマ定義
└── docs/                   # ドキュメント
```

### 各ディレクトリの役割

| ディレクトリ     | 説明                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| `.devcontainer/` | VS Code Dev Containers用の設定。開発環境の自動構築に使用                               |
| `docker/`        | 本番・ステージング環境用のDocker設定                                                   |
| `src/common/`    | アプリケーション全体で使用する共通コンポーネント（例外フィルター、インターセプター等） |
| `src/prisma/`    | Prismaクライアントのサービス。DBへの接続を管理                                         |
| `src/users/`     | ユーザー関連のコントローラー、サービス、DTO                                            |
| `prisma/`        | データベーススキーマ定義（schema.prisma）                                              |
| `docs/`          | プロジェクトのドキュメント                                                             |

## 開発環境のセットアップ

### 前提条件

- [VS Code](https://code.visualstudio.com/)
- [Dev Containers拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### セットアップ手順

1. **リポジトリをクローン**

   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```

2. **VS Codeでプロジェクトを開く**

   ```bash
   code .
   ```

3. **Dev Containerで開く**
   - VS Codeの左下の「><」アイコンをクリック
   - 「Reopen in Container」を選択
   - または、コマンドパレット（`Ctrl+Shift+P` / `Cmd+Shift+P`）から「Dev Containers: Reopen in Container」を実行

4. **依存関係のインストール**
   - コンテナ起動時に自動で `pnpm install` が実行されます

5. **データベースマイグレーション**
   ```bash
   npx prisma migrate dev
   ```

### ポート

| ポート | 用途             |
| ------ | ---------------- |
| 3000   | アプリケーション |
| 5432   | PostgreSQL       |

## 利用可能なコマンド

プロジェクトルートで以下のコマンドを実行できます。

| コマンド              | 説明                                   |
| --------------------- | -------------------------------------- |
| `pnpm run start:dev`  | 開発サーバー起動（ホットリロード有効） |
| `pnpm run build`      | プロダクションビルド                   |
| `pnpm run start:prod` | 本番モードで起動                       |
| `pnpm run test`       | テスト実行                             |
| `pnpm run test:watch` | テスト監視モード                       |
| `pnpm run test:cov`   | カバレッジ付きテスト                   |
| `pnpm run test:e2e`   | E2Eテスト実行                          |
| `pnpm run lint`       | ESLintによるコードチェック             |
| `pnpm run format`     | Prettierによるコードフォーマット       |

## 環境変数

| 変数名         | 説明              | デフォルト値（devcontainer）                      |
| -------------- | ----------------- | ------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL接続URL | `postgresql://postgres:postgres@db:5432/helpline` |

Dev Container使用時は環境変数が自動設定されるため、手動設定は不要です。

## 参考ドキュメント

- [エラーハンドリング](docs/error-handling.md)
- [テストガイドライン](docs/testing-guidelines.md)

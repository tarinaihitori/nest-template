# テスト方針ガイドライン

## 概要

本プロジェクトでは、古典学派（Detroit School/Classical School）のアプローチに基づいた単体テストを実装する。

## 古典学派（Detroit School）の原則

### 1. 本物のオブジェクトを優先
可能な限り実際の依存オブジェクトを使用する。テストダブル（モック、スタブ）は必要最小限に抑える。

### 2. 外部依存のみモック化
以下の「管理外の依存」のみテストダブルを使用する：
- データベース
- 外部API
- ファイルシステム
- 現在時刻
- 乱数生成

### 3. 振る舞いのテスト
実装の詳細（メソッド呼び出し回数など）ではなく、観測可能な振る舞いを検証する。

### 4. テストの独立性
各テストは他のテストに依存せず、独立して実行可能であること。

## t_wada推奨のテスト原則

### 1. テストは実行可能な仕様書
テスト名で振る舞いを明確に記述する。テストを読めば、その機能が何をするか理解できるようにする。

### 2. AAAパターン
テストは以下の3つのフェーズで構成する：
- **Arrange（準備）**: テストに必要なデータや状態を準備
- **Act（実行）**: テスト対象のメソッドを実行
- **Assert（検証）**: 結果を検証

```typescript
it('指定されたIDのユーザーを返すこと', async () => {
  // Arrange
  const expectedUser = { id: 'v1StGXR8_Z5jdHi6B', email: 'test@example.com', name: 'Test' };
  repository.findOne.mockResolvedValue(expectedUser);

  // Act
  const result = await service.findOne('v1StGXR8_Z5jdHi6B');

  // Assert
  expect(result).toEqual(expectedUser);
});
```

### 3. テスト名は日本語で記述
振る舞いを明確にするため「〜すること」形式で記述する。

```typescript
// Good
it('存在しないIDの場合NotFoundExceptionをスローすること', ...)

// Bad
it('should throw NotFoundException when user not found', ...)
```

### 4. 過剰なモックを避ける
必要最小限のテストダブルのみ使用する。モックが増えると、テストが実装の詳細に依存しやすくなる。

### 5. 検証は振る舞いに集中
`toHaveBeenCalledWith` より `toEqual` を優先する。

```typescript
// Good: 戻り値を検証
expect(result).toEqual(expectedUser);

// Avoid: メソッド呼び出しを検証（必要な場合のみ使用）
expect(repository.findOne).toHaveBeenCalledWith('v1StGXR8_Z5jdHi6B');
```

## 本プロジェクトへの適用

### アーキテクチャとモック境界

```
Controller → Service → Repository → PrismaService(DB)
                           ↑
                      ここがモック境界
```

### 各レイヤーのテスト方針

| レイヤー | テスト対象 | モック対象 |
|---------|-----------|-----------|
| UsersService | ビジネスロジック | UsersRepository |
| UsersRepository | データアクセスロジック | PrismaService |

### UsersService テスト
- UsersRepositoryをスタブ化（DBアクセスを避けるため）
- ビジネスロジック（例外処理など）を検証

### UsersRepository テスト
- PrismaServiceをスタブ化（DBアクセスを避けるため）
- Prismaメソッドの正しい呼び出しを検証

## テストファイルの配置（Co-locationパターン）

テストファイルは実装ファイルと同じディレクトリに配置する。

```
src/
├── users/
│   ├── users.service.ts
│   ├── users.service.spec.ts     # ← 実装と同階層
│   ├── users.repository.ts
│   └── users.repository.spec.ts  # ← 実装と同階層
├── auth/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── jwt-auth.guard.spec.ts  # ← 実装と同階層
│   │   ├── roles.guard.ts
│   │   └── roles.guard.spec.ts     # ← 実装と同階層
│   └── services/
│       ├── jwt-verification.service.ts
│       └── jwt-verification.service.spec.ts  # ← 実装と同階層
```

### なぜCo-locationパターンか

- **関連性の明確化**: テストと実装が隣り合うため、関連性が一目でわかる
- **ナビゲーションの容易さ**: 実装ファイルを開いた状態でテストファイルを見つけやすい
- **保守性の向上**: 実装の移動や削除時にテストファイルを忘れにくい
- **`__tests__`フォルダは使用しない**: ファイルが離れてしまい、管理が煩雑になる

## テストファイルの命名規則

- 単体テスト: `*.spec.ts`
- E2Eテスト: `*.e2e-spec.ts`

## テスト実行コマンド

```bash
# 全テスト実行
pnpm test

# ウォッチモード
pnpm test:watch

# カバレッジレポート
pnpm test:cov

# E2Eテスト
pnpm test:e2e
```

## 参考資料

- 「単体テストの考え方/使い方」(Vladimir Khorikov著)
- t_wada氏のテスト駆動開発に関する講演資料

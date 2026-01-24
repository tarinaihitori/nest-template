/**
 * JWTペイロードの型定義
 *
 * JWTトークンのデコード後のペイロードを表す。
 * 標準的なJWTクレーム（RFC 7519）に加えて、
 * カスタムクレーム（ロール、スコープなど）も格納可能。
 *
 * @example
 * ```typescript
 * // 基本的なペイロード
 * const payload: JwtPayload = {
 *   sub: 'user-123',
 *   iat: 1609459200,
 *   exp: 1609545600,
 *   iss: 'https://auth.example.com',
 *   aud: 'my-api',
 * };
 *
 * // カスタムクレームを含むペイロード
 * const payloadWithCustom: JwtPayload = {
 *   sub: 'user-123',
 *   roles: ['admin', 'user'],
 *   scope: 'read write',
 *   email: 'user@example.com',
 * };
 * ```
 */
export interface JwtPayload {
  /**
   * Subject - トークンの主体（通常はユーザーID）
   */
  sub: string;

  /**
   * Issued At - トークンの発行日時（Unix timestamp）
   */
  iat?: number;

  /**
   * Expiration Time - トークンの有効期限（Unix timestamp）
   */
  exp?: number;

  /**
   * Issuer - トークンの発行者（認証サーバーのURL等）
   */
  iss?: string;

  /**
   * Audience - トークンの対象者（APIのID等）
   */
  aud?: string | string[];

  /**
   * カスタムクレーム（ロール、スコープ、メールアドレスなど）
   */
  [key: string]: unknown;
}

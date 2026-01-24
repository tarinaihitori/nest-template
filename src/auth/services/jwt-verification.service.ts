import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces';

/**
 * クレーム抽出設定
 */
interface ClaimConfig {
  rolesClaim: string;
  scopesClaim: string;
  scopesDelimiter: string;
}

/**
 * JWTクレーム抽出サービス
 *
 * JWTペイロードからロール・スコープを抽出するサービス。
 * トークンの検証はpassport-jwtが担当し、このサービスは
 * 検証済みペイロードからのクレーム抽出のみを行う。
 *
 * ## 環境変数
 * | 変数名 | 必須 | 説明 |
 * |--------|------|------|
 * | JWT_ROLES_CLAIM | - | ロールクレームのパス（デフォルト: roles） |
 * | JWT_SCOPES_CLAIM | - | スコープクレームのパス（デフォルト: scope） |
 * | JWT_SCOPES_DELIMITER | - | スコープの区切り文字（デフォルト: スペース） |
 *
 * @example
 * ```typescript
 * // ロールの抽出
 * const roles = jwtVerificationService.extractRoles(payload);
 *
 * // スコープの抽出
 * const scopes = jwtVerificationService.extractScopes(payload);
 * ```
 */
@Injectable()
export class JwtVerificationService {
  private readonly config: ClaimConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
  }

  /**
   * 環境変数からクレーム抽出設定を読み込む
   *
   * @returns クレーム抽出設定オブジェクト
   */
  private loadConfig(): ClaimConfig {
    const rolesClaim = this.configService.get<string>('JWT_ROLES_CLAIM');
    const scopesClaim = this.configService.get<string>('JWT_SCOPES_CLAIM');
    const scopesDelimiter = this.configService.get<string>(
      'JWT_SCOPES_DELIMITER',
    );

    return {
      rolesClaim: rolesClaim || 'roles',
      scopesClaim: scopesClaim || 'scope',
      scopesDelimiter: scopesDelimiter || ' ',
    };
  }

  /**
   * JWTペイロードからロールを抽出する
   *
   * `JWT_ROLES_CLAIM` で指定されたパスからロールを取得する。
   * ドット区切りのパスに対応しており、ネストされたクレームからも抽出可能。
   *
   * @param payload - JWTペイロード
   * @returns ロール名の配列（ロールが見つからない場合は空配列）
   *
   * @example
   * ```typescript
   * // JWT_ROLES_CLAIM="roles" の場合
   * // payload: { roles: ["admin", "user"] }
   * extractRoles(payload); // => ["admin", "user"]
   *
   * // JWT_ROLES_CLAIM="realm_access.roles" の場合
   * // payload: { realm_access: { roles: ["admin"] } }
   * extractRoles(payload); // => ["admin"]
   * ```
   */
  extractRoles(payload: JwtPayload): string[] {
    const claimPath = this.config.rolesClaim.split('.');
    let value: unknown = payload;

    for (const key of claimPath) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return [];
      }
    }

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value === 'string') {
      return [value];
    }

    return [];
  }

  /**
   * JWTペイロードからスコープを抽出する
   *
   * `JWT_SCOPES_CLAIM` で指定されたパスからスコープを取得する。
   * スコープは配列または区切り文字で連結された文字列として格納されている場合がある。
   * 文字列の場合は `JWT_SCOPES_DELIMITER` で分割される。
   *
   * @param payload - JWTペイロード
   * @returns スコープの配列（スコープが見つからない場合は空配列）
   *
   * @example
   * ```typescript
   * // JWT_SCOPES_CLAIM="scope", JWT_SCOPES_DELIMITER=" " の場合
   * // payload: { scope: "read write admin:read" }
   * extractScopes(payload); // => ["read", "write", "admin:read"]
   *
   * // 配列形式の場合
   * // payload: { scope: ["read", "write"] }
   * extractScopes(payload); // => ["read", "write"]
   * ```
   */
  extractScopes(payload: JwtPayload): string[] {
    const claimPath = this.config.scopesClaim.split('.');
    let value: unknown = payload;

    for (const key of claimPath) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return [];
      }
    }

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value === 'string') {
      return value
        .split(this.config.scopesDelimiter)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    return [];
  }
}

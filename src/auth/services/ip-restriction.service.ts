import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * IP制限サービス
 *
 * ユーザーごとの許可IPアドレスをデータベースから取得し、
 * リクエスト元IPアドレスが許可されているかを検証する。
 *
 * ## 動作
 * - ユーザーに許可IPが設定されていない場合は全IP許可
 * - 許可IPが設定されている場合は、リクエスト元IPが許可リストに含まれているかチェック
 *
 * @example
 * ```typescript
 * // 許可IP一覧を取得
 * const allowedIps = await ipRestrictionService.getAllowedIps('user-123');
 *
 * // IPが許可されているかチェック
 * const isAllowed = await ipRestrictionService.isIpAllowed('user-123', '192.168.1.1');
 * ```
 */
@Injectable()
export class IpRestrictionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ユーザーの許可IPアドレス一覧を取得する
   *
   * @param userId - ユーザーID
   * @returns 許可IPアドレスの配列
   */
  async getAllowedIps(userId: string): Promise<string[]> {
    const records = await this.prisma.userAllowedIp.findMany({
      where: { userId },
      select: { ipAddress: true },
    });

    return records.map((record) => record.ipAddress);
  }

  /**
   * 指定されたIPアドレスがユーザーに許可されているかチェックする
   *
   * 許可IPが設定されていない場合は全IP許可として扱う。
   * 単一IPアドレスとCIDR表記（例: 10.0.0.0/8）の両方に対応。
   *
   * @param userId - ユーザーID
   * @param ipAddress - チェック対象のIPアドレス
   * @returns 許可されている場合はtrue
   */
  async isIpAllowed(userId: string, ipAddress: string): Promise<boolean> {
    const allowedIps = await this.getAllowedIps(userId);

    // 許可IPが設定されていない場合は全IP許可
    if (allowedIps.length === 0) {
      return true;
    }

    return allowedIps.some((allowed) => this.matchIp(ipAddress, allowed));
  }

  /**
   * IPアドレスが許可パターンにマッチするかチェックする
   *
   * @param clientIp - クライアントのIPアドレス
   * @param allowedPattern - 許可パターン（単一IP or CIDR）
   * @returns マッチする場合はtrue
   */
  private matchIp(clientIp: string, allowedPattern: string): boolean {
    if (allowedPattern.includes('/')) {
      return this.matchCidr(clientIp, allowedPattern);
    }
    return clientIp === allowedPattern;
  }

  /**
   * IPアドレスがCIDR範囲にマッチするかチェックする
   *
   * @param ip - チェック対象のIPアドレス
   * @param cidr - CIDR表記（例: 10.0.0.0/8）
   * @returns マッチする場合はtrue
   */
  private matchCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(range);
    return (ipNum & mask) === (rangeNum & mask);
  }

  /**
   * IPv4アドレスを32ビット整数に変換する
   *
   * @param ip - IPv4アドレス（例: 192.168.1.1）
   * @returns 32ビット整数
   */
  private ipToNumber(ip: string): number {
    return ip
      .split('.')
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
  }
}

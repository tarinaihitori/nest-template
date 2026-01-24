/**
 * ユーザーの許可IPアドレス情報
 */
export interface UserAllowedIp {
  /**
   * レコードID
   */
  id: string;

  /**
   * ユーザーID
   */
  userId: string;

  /**
   * 許可されたIPアドレス
   */
  ipAddress: string;

  /**
   * 作成日時
   */
  createdAt: Date;
}

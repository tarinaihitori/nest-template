import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IpRestrictionService } from './ip-restriction.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('IpRestrictionService', () => {
  let service: IpRestrictionService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      userAllowedIp: {
        findMany: vi.fn(),
      },
    } as unknown as PrismaService;

    service = new IpRestrictionService(prisma);
  });

  describe('getAllowedIps', () => {
    it('ユーザーの許可IPアドレス一覧を返すこと', async () => {
      // Arrange
      const userId = 'user-123';
      vi.mocked(prisma.userAllowedIp.findMany).mockResolvedValue([
        { id: '1', userId, ipAddress: '192.168.1.1', createdAt: new Date() },
        { id: '2', userId, ipAddress: '192.168.1.2', createdAt: new Date() },
      ]);

      // Act
      const result = await service.getAllowedIps(userId);

      // Assert
      expect(result).toEqual(['192.168.1.1', '192.168.1.2']);
      expect(prisma.userAllowedIp.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: { ipAddress: true },
      });
    });

    it('許可IPが設定されていない場合は空配列を返すこと', async () => {
      // Arrange
      const userId = 'user-123';
      vi.mocked(prisma.userAllowedIp.findMany).mockResolvedValue([]);

      // Act
      const result = await service.getAllowedIps(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('isIpAllowed', () => {
    it('許可IPリストに含まれている場合はtrueを返すこと', async () => {
      // Arrange
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';
      vi.mocked(prisma.userAllowedIp.findMany).mockResolvedValue([
        { id: '1', userId, ipAddress: '192.168.1.1', createdAt: new Date() },
        { id: '2', userId, ipAddress: '192.168.1.2', createdAt: new Date() },
      ]);

      // Act
      const result = await service.isIpAllowed(userId, ipAddress);

      // Assert
      expect(result).toBe(true);
    });

    it('許可IPリストに含まれていない場合はfalseを返すこと', async () => {
      // Arrange
      const userId = 'user-123';
      const ipAddress = '10.0.0.1';
      vi.mocked(prisma.userAllowedIp.findMany).mockResolvedValue([
        { id: '1', userId, ipAddress: '192.168.1.1', createdAt: new Date() },
      ]);

      // Act
      const result = await service.isIpAllowed(userId, ipAddress);

      // Assert
      expect(result).toBe(false);
    });

    it('許可IPが設定されていない場合は全IP許可（trueを返す）こと', async () => {
      // Arrange
      const userId = 'user-123';
      const ipAddress = '10.0.0.1';
      vi.mocked(prisma.userAllowedIp.findMany).mockResolvedValue([]);

      // Act
      const result = await service.isIpAllowed(userId, ipAddress);

      // Assert
      expect(result).toBe(true);
    });

    it('CIDR 10.0.0.0/8 に 10.1.2.3 がマッチすること', async () => {
      // Arrange
      const userId = 'user-123';
      const ipAddress = '10.1.2.3';
      vi.mocked(prisma.userAllowedIp.findMany).mockResolvedValue([
        { id: '1', userId, ipAddress: '10.0.0.0/8', createdAt: new Date() },
      ]);

      // Act
      const result = await service.isIpAllowed(userId, ipAddress);

      // Assert
      expect(result).toBe(true);
    });

    it('CIDR 192.168.1.0/24 に 192.168.1.100 がマッチすること', async () => {
      // Arrange
      const userId = 'user-123';
      const ipAddress = '192.168.1.100';
      vi.mocked(prisma.userAllowedIp.findMany).mockResolvedValue([
        { id: '1', userId, ipAddress: '192.168.1.0/24', createdAt: new Date() },
      ]);

      // Act
      const result = await service.isIpAllowed(userId, ipAddress);

      // Assert
      expect(result).toBe(true);
    });

    it('CIDR 192.168.1.0/24 に 192.168.2.1 がマッチしないこと', async () => {
      // Arrange
      const userId = 'user-123';
      const ipAddress = '192.168.2.1';
      vi.mocked(prisma.userAllowedIp.findMany).mockResolvedValue([
        { id: '1', userId, ipAddress: '192.168.1.0/24', createdAt: new Date() },
      ]);

      // Act
      const result = await service.isIpAllowed(userId, ipAddress);

      // Assert
      expect(result).toBe(false);
    });

    it('単一IPとCIDRが混在している場合に正しくマッチすること', async () => {
      // Arrange
      const userId = 'user-123';
      vi.mocked(prisma.userAllowedIp.findMany).mockResolvedValue([
        { id: '1', userId, ipAddress: '192.168.1.100', createdAt: new Date() },
        { id: '2', userId, ipAddress: '10.0.0.0/8', createdAt: new Date() },
        { id: '3', userId, ipAddress: '172.16.0.0/12', createdAt: new Date() },
      ]);

      // Act & Assert
      // 単一IPにマッチ
      expect(await service.isIpAllowed(userId, '192.168.1.100')).toBe(true);
      // CIDR 10.0.0.0/8 にマッチ
      expect(await service.isIpAllowed(userId, '10.255.255.255')).toBe(true);
      // CIDR 172.16.0.0/12 にマッチ
      expect(await service.isIpAllowed(userId, '172.20.5.10')).toBe(true);
      // どれにもマッチしない
      expect(await service.isIpAllowed(userId, '8.8.8.8')).toBe(false);
    });
  });
});

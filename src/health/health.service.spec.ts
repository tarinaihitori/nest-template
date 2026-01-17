import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = {
      $queryRaw: vi.fn(),
    } as unknown as PrismaService;

    service = new HealthService(prismaService);
  });

  describe('check', () => {
    it('データベースが正常な場合healthyステータスを返すこと', async () => {
      // Arrange
      vi.mocked(prismaService.$queryRaw).mockResolvedValue([{ 1: 1 }]);

      // Act
      const result = await service.check();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.database.responseTime).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
    });

    it('データベースがダウンしている場合unhealthyステータスを返すこと', async () => {
      // Arrange
      vi.mocked(prismaService.$queryRaw).mockRejectedValue(
        new Error('Connection failed'),
      );

      // Act
      const result = await service.check();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('down');
      expect(result.checks.database.responseTime).toBeUndefined();
    });
  });
});

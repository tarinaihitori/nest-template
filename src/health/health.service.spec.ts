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
    it('should return healthy status when database is up', async () => {
      vi.mocked(prismaService.$queryRaw).mockResolvedValue([{ 1: 1 }]);

      const result = await service.check();

      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.database.responseTime).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
    });

    it('should return unhealthy status when database is down', async () => {
      vi.mocked(prismaService.$queryRaw).mockRejectedValue(
        new Error('Connection failed'),
      );

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('down');
      expect(result.checks.database.responseTime).toBeUndefined();
    });
  });
});

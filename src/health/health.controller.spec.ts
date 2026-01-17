import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { HealthController } from './health.controller';
import { HealthService, HealthCheckResult } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;
  let mockReply: FastifyReply;

  beforeEach(() => {
    healthService = {
      check: vi.fn(),
    } as unknown as HealthService;

    controller = new HealthController(healthService);

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as FastifyReply;
  });

  describe('check', () => {
    it('正常な場合200を返すこと', async () => {
      // Arrange
      const healthyResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        checks: {
          database: { status: 'up', responseTime: 5 },
        },
      };
      vi.mocked(healthService.check).mockResolvedValue(healthyResult);

      // Act
      await controller.check(mockReply);

      // Assert
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith(healthyResult);
    });

    it('異常な場合503を返すこと', async () => {
      // Arrange
      const unhealthyResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        checks: {
          database: { status: 'down' },
        },
      };
      vi.mocked(healthService.check).mockResolvedValue(unhealthyResult);

      // Act
      await controller.check(mockReply);

      // Assert
      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      expect(mockReply.send).toHaveBeenCalledWith(unhealthyResult);
    });
  });

  describe('liveness', () => {
    it('okステータスを返すこと', () => {
      // Arrange & Act
      const result = controller.liveness();

      // Assert
      expect(result).toEqual({ status: 'ok' });
    });
  });
});

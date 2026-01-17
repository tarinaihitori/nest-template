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
    it('should return 200 when healthy', async () => {
      const healthyResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        checks: {
          database: { status: 'up', responseTime: 5 },
        },
      };

      vi.mocked(healthService.check).mockResolvedValue(healthyResult);

      await controller.check(mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith(healthyResult);
    });

    it('should return 503 when unhealthy', async () => {
      const unhealthyResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        checks: {
          database: { status: 'down' },
        },
      };

      vi.mocked(healthService.check).mockResolvedValue(unhealthyResult);

      await controller.check(mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      expect(mockReply.send).toHaveBeenCalledWith(unhealthyResult);
    });
  });

  describe('liveness', () => {
    it('should return ok status', () => {
      const result = controller.liveness();

      expect(result).toEqual({ status: 'ok' });
    });
  });
});

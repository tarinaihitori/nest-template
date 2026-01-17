import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
    };
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();

    const databaseCheck = await this.checkDatabase();

    const isHealthy = databaseCheck.status === 'up';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp,
      uptime,
      checks: {
        database: databaseCheck,
      },
    };
  }

  private async checkDatabase(): Promise<{
    status: 'up' | 'down';
    responseTime?: number;
  }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        responseTime: Date.now() - start,
      };
    } catch {
      return {
        status: 'down',
      };
    }
  }
}

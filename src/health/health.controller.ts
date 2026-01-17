import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth/decorators';
import { HealthService } from './health.service';
import type { HealthCheckResult } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res() reply: FastifyReply): Promise<void> {
    const result: HealthCheckResult = await this.healthService.check();

    const statusCode =
      result.status === 'healthy'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE;

    reply.status(statusCode).send(result);
  }

  @Public()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  liveness(): { status: string } {
    return { status: 'ok' };
  }
}

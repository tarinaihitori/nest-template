import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? ['warn', 'error']
          : [
              { level: 'query', emit: 'stdout' },
              { level: 'info', emit: 'stdout' },
              { level: 'warn', emit: 'stdout' },
              { level: 'error', emit: 'stdout' },
            ],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PinoLogger, getLoggerToken } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health';
import { LoggerModule } from './common/logger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    UsersModule,
  ],
  providers: [
    {
      provide: getLoggerToken(AllExceptionsFilter.name),
      useFactory: (logger: PinoLogger) => {
        logger.setContext(AllExceptionsFilter.name);
        return logger;
      },
      inject: [PinoLogger],
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtVerificationService } from './services';
import { JwtAuthGuard, RolesGuard } from './guards';

@Module({
  imports: [ConfigModule],
  providers: [
    JwtVerificationService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [JwtVerificationService],
})
export class AuthModule {}

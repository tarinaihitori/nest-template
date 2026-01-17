import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtVerificationService } from './services';
import { JwtAuthGuard, RolesGuard, ScopesGuard } from './guards';

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
    {
      provide: APP_GUARD,
      useClass: ScopesGuard,
    },
  ],
  exports: [JwtVerificationService],
})
export class AuthModule {}

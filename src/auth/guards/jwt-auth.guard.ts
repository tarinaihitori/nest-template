import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { JwtVerificationService } from '../services';
import { IS_PUBLIC_KEY } from '../decorators';
import { JwtPayload } from '../interfaces';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @InjectPinoLogger(JwtAuthGuard.name)
    private readonly logger: PinoLogger,
    private readonly jwtVerificationService: JwtVerificationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new BusinessException(
        ErrorCodes.TOKEN_MISSING,
        'Authorization token is required',
        401,
      );
    }

    try {
      const payload = await this.jwtVerificationService.verify(token);
      (request as FastifyRequest & { user: JwtPayload }).user = payload;
      return true;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }

      this.logger.error({ err: error as Error }, 'JWT verification failed');
      throw new BusinessException(
        ErrorCodes.TOKEN_INVALID,
        'Token verification failed',
        401,
      );
    }
  }

  private extractToken(request: FastifyRequest): string | undefined {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }
}

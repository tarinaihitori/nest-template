import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { JwtVerificationService } from '../services';
import { ROLES_KEY } from '../decorators';
import { JwtPayload } from '../interfaces';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly jwtVerificationService: JwtVerificationService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user?: JwtPayload }).user;

    if (!user) {
      throw new BusinessException(
        ErrorCodes.TOKEN_MISSING,
        'User not authenticated',
        401,
      );
    }

    const userRoles = this.jwtVerificationService.extractRoles(user);
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new BusinessException(
        ErrorCodes.INSUFFICIENT_PERMISSIONS,
        `Required roles: ${requiredRoles.join(', ')}`,
        403,
      );
    }

    return true;
  }
}

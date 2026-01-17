import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { JwtVerificationService } from '../services';
import { SCOPES_KEY } from '../decorators';
import { JwtPayload } from '../interfaces';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(
    private readonly jwtVerificationService: JwtVerificationService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
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

    const userScopes = this.jwtVerificationService.extractScopes(user);
    const hasScope = requiredScopes.some((requiredScope) =>
      this.matchesScope(userScopes, requiredScope),
    );

    if (!hasScope) {
      throw new BusinessException(
        ErrorCodes.INSUFFICIENT_SCOPE,
        `Required scopes: ${requiredScopes.join(', ')}`,
        403,
      );
    }

    return true;
  }

  private matchesScope(userScopes: string[], requiredScope: string): boolean {
    return userScopes.some((userScope) => {
      // Exact match
      if (userScope === requiredScope) {
        return true;
      }

      // Wildcard match: user has `*` which matches everything
      if (userScope === '*') {
        return true;
      }

      // Wildcard match: user has `admin:*` which matches `admin:read`, `admin:write`, etc.
      if (userScope.endsWith(':*')) {
        const prefix = userScope.slice(0, -1); // Remove trailing `*`, keep `admin:`
        return requiredScope.startsWith(prefix);
      }

      return false;
    });
  }
}

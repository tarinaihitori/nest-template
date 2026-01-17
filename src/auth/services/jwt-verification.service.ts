import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import jwksRsa, { JwksClient } from 'jwks-rsa';
import { AuthConfig, JwtPayload } from '../interfaces';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';

@Injectable()
export class JwtVerificationService {
  private readonly config: AuthConfig;
  private readonly jwksClient?: JwksClient;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();

    if (this.config.jwksUri) {
      this.jwksClient = jwksRsa({
        jwksUri: this.config.jwksUri,
        cache: true,
        cacheMaxAge: 600000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      });
    }
  }

  private loadConfig(): AuthConfig {
    const jwksUri = this.configService.get<string>('JWT_JWKS_URI');
    const secret = this.configService.get<string>('JWT_SECRET');
    const issuer = this.configService.get<string>('JWT_ISSUER');
    const audience = this.configService.get<string>('JWT_AUDIENCE');
    const algorithms = this.configService.get<string>('JWT_ALGORITHMS');
    const rolesClaim = this.configService.get<string>('JWT_ROLES_CLAIM');

    return {
      jwksUri,
      secret,
      issuer: issuer ? issuer.split(',').map((s) => s.trim()) : undefined,
      audience: audience ? audience.split(',').map((s) => s.trim()) : undefined,
      algorithms: algorithms
        ? algorithms.split(',').map((s) => s.trim())
        : ['RS256', 'HS256'],
      rolesClaim: rolesClaim || 'roles',
    };
  }

  async verify(token: string): Promise<JwtPayload> {
    if (this.config.jwksUri && this.jwksClient) {
      return this.verifyWithJwks(token);
    }

    if (this.config.secret) {
      return this.verifyWithSecret(token);
    }

    throw new UnauthorizedException(
      'JWT verification is not configured. Set JWT_JWKS_URI or JWT_SECRET.',
    );
  }

  private async verifyWithJwks(token: string): Promise<JwtPayload> {
    const getKey = (
      header: jwt.JwtHeader,
      callback: jwt.SigningKeyCallback,
    ): void => {
      if (!header.kid) {
        callback(new Error('Token header missing kid'));
        return;
      }

      this.jwksClient!.getSigningKey(header.kid, (err, key) => {
        if (err) {
          callback(err);
          return;
        }
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
      });
    };

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        this.getVerifyOptions(),
        (err, decoded) => {
          if (err) {
            reject(this.handleJwtError(err));
            return;
          }
          resolve(decoded as JwtPayload);
        },
      );
    });
  }

  private verifyWithSecret(token: string): Promise<JwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.config.secret!,
        this.getVerifyOptions(),
        (err, decoded) => {
          if (err) {
            reject(this.handleJwtError(err));
            return;
          }
          resolve(decoded as JwtPayload);
        },
      );
    });
  }

  private getVerifyOptions(): jwt.VerifyOptions {
    const options: jwt.VerifyOptions = {
      algorithms: this.config.algorithms as jwt.Algorithm[],
    };

    if (this.config.issuer && this.config.issuer.length > 0) {
      options.issuer = this.config.issuer as [string, ...string[]];
    }

    if (this.config.audience && this.config.audience.length > 0) {
      options.audience = this.config.audience as [string, ...string[]];
    }

    return options;
  }

  private handleJwtError(err: jwt.VerifyErrors): BusinessException {
    if (err.name === 'TokenExpiredError') {
      return new BusinessException(
        ErrorCodes.TOKEN_EXPIRED,
        'Token has expired',
        401,
      );
    }

    if (err.name === 'NotBeforeError') {
      return new BusinessException(
        ErrorCodes.TOKEN_INVALID,
        'Token not yet valid',
        401,
      );
    }

    if (err.name === 'JsonWebTokenError') {
      return new BusinessException(
        ErrorCodes.TOKEN_INVALID,
        `Invalid token: ${err.message}`,
        401,
      );
    }

    return new BusinessException(
      ErrorCodes.TOKEN_INVALID,
      'Token verification failed',
      401,
    );
  }

  getRolesClaim(): string {
    return this.config.rolesClaim;
  }

  extractRoles(payload: JwtPayload): string[] {
    const claimPath = this.config.rolesClaim.split('.');
    let value: unknown = payload;

    for (const key of claimPath) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return [];
      }
    }

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value === 'string') {
      return [value];
    }

    return [];
  }
}

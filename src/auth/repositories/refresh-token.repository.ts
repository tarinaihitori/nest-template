import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshToken } from '@prisma/client';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    token: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data,
    });
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async findByTokenWithUser(
    token: string,
  ): Promise<(RefreshToken & { user: { id: string; email: string; name: string | null } }) | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async revokeToken(token: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpiredTokens(): Promise<{ count: number }> {
    return this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });
  }
}

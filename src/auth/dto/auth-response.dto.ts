import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty({
    description: 'アクセストークン',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'リフレッシュトークン',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}

export class AuthUserDto {
  @ApiProperty({
    description: 'ユーザーID',
    example: 'abc123xyz789',
  })
  id: string;

  @ApiProperty({
    description: 'メールアドレス',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'ユーザー名',
    example: 'John Doe',
    nullable: true,
  })
  name: string | null;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'ユーザー情報',
    type: AuthUserDto,
  })
  user: AuthUserDto;

  @ApiProperty({
    description: '認証トークン',
    type: AuthTokensDto,
  })
  tokens: AuthTokensDto;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'メッセージ',
    example: 'ログアウトしました',
  })
  message: string;
}

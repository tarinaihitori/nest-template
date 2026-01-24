import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'ユーザーのメールアドレス',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'メールアドレスの形式が正しくありません' })
  email: string;

  @ApiProperty({
    description: 'パスワード',
    example: 'password123',
  })
  @IsString()
  password: string;
}

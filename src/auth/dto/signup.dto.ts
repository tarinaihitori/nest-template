import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({
    description: 'ユーザーのメールアドレス',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'メールアドレスの形式が正しくありません' })
  email: string;

  @ApiProperty({
    description: 'パスワード（8文字以上）',
    example: 'password123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'パスワードは8文字以上で入力してください' })
  @MaxLength(128, { message: 'パスワードは128文字以下で入力してください' })
  password: string;

  @ApiProperty({
    description: 'ユーザー名（任意）',
    example: 'John Doe',
    required: false,
  })
  @IsString()
  @MaxLength(100, { message: '名前は100文字以下で入力してください' })
  name?: string;
}

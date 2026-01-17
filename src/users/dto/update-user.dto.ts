import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'name must be at most 100 characters' })
  name?: string;
}

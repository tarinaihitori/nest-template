import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './services';
import {
  SignupDto,
  LoginDto,
  RefreshTokenDto,
  AuthResponseDto,
  AuthTokensDto,
  MessageResponseDto,
} from './dto';
import { Public, CurrentUser } from './decorators';
import type { JwtPayload } from './interfaces';

@ApiTags('認証')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @ApiOperation({ summary: '新規ユーザー登録' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'ユーザー登録成功',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'メールアドレスが既に登録されている',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'バリデーションエラー',
  })
  async signup(@Body() signupDto: SignupDto): Promise<AuthResponseDto> {
    return this.authService.signup(signupDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ログイン' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ログイン成功',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'メールアドレスまたはパスワードが正しくない',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'アクセストークン更新' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'トークン更新成功',
    type: AuthTokensDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'リフレッシュトークンが無効または期限切れ',
  })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthTokensDto> {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ログアウト' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ログアウト成功',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '認証が必要',
  })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<MessageResponseDto> {
    await this.authService.logout(user.sub, refreshTokenDto.refreshToken);
    return { message: 'ログアウトしました' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '全デバイスからログアウト' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '全デバイスからログアウト成功',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '認証が必要',
  })
  async logoutAll(@CurrentUser() user: JwtPayload): Promise<MessageResponseDto> {
    await this.authService.logoutAll(user.sub);
    return { message: '全てのデバイスからログアウトしました' };
  }
}

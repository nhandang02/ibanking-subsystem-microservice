import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards,
    Logger,
    UnauthorizedException,
  } from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags, ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AccessTokenGuard, RefreshTokenGuard } from '@ibanking/shared';
import { SigninDto } from './dto/signin';
import { SignupDto } from './dto/signup.dto';

export interface RequestWithUser extends Request {
    user?: {
      id: string;
      username: string;
      email: string;
      fullName: string;
      phoneNumber: string;
      availableBalance: string;
      createdAt: Date;
      isActive: boolean;
    };
    cookies: {
      refresh_token?: string;
    };
  }
  
  export interface RequestWithJwtPayload extends Request {
    user?: {
      sub: string;
      email?: string;
      username?: string;
    };
    cookies: {
      refresh_token?: string;
    };
  }

  
  @ApiTags('Authentication')
  @Controller('auth')
  export class AuthController {
    private readonly logger = new Logger(AuthController.name);
  
    constructor(
      private readonly authService: AuthService,
    ) {}
  
    @Post('signup')
    async signup(
      @Body() registerDto: SignupDto,
      @Res({ passthrough: true }) response: Response,
    ) {
      try {
        Logger.log('Signup request received');
        return await this.authService.signUp(registerDto, response);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Signup failed:', errorMessage);
        throw new UnauthorizedException('Signup failed: ' + errorMessage);
      }
    }
  
    @Post('signin')
    async signin(
      @Body() data: SigninDto,
      @Res({ passthrough: true }) response: Response,
    ) {
      try {
        return await this.authService.signIn(data, response);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Signin failed:', errorMessage);
        throw new UnauthorizedException('Signin failed: ' + errorMessage);
      }
    }
  
    @Post('logout')
    @UseGuards(RefreshTokenGuard)
    @ApiCookieAuth()
    async logout(
      @Req() req: RequestWithJwtPayload,
      @Res({ passthrough: true }) res: Response,
    ) {
      try {
        const userId = req.user?.sub;
        const refreshToken = req.cookies?.refresh_token;

        if (!userId || !refreshToken) {
          throw new UnauthorizedException('Invalid credentials');
        }

        return await this.authService.logout(userId, refreshToken, res);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Logout failed:', errorMessage);
        throw new UnauthorizedException('Logout failed: ' + errorMessage);
      }
    }
  
    @Get('refresh')
    @UseGuards(RefreshTokenGuard)
    @ApiCookieAuth()
    async refreshTokens(
      @Req() req: RequestWithJwtPayload,
      @Res({ passthrough: true }) res: Response,
    ) {
      try {
        Logger.log('Refresh token request received' + req.user);
        const userId = req.user?.sub;
        const refreshToken = req.cookies?.refresh_token;
  
        if (!userId || !refreshToken) {
          throw new UnauthorizedException('Invalid credentials');
        }
        
        return await this.authService.refreshTokens(userId, refreshToken, res);
      } catch (error: unknown) {
        const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Token refresh failed:', errorMessage);
        throw new UnauthorizedException('Token refresh failed: ' + errorMessage);
      }
    }
  
    @Get('logout-all')
    @UseGuards(AccessTokenGuard)
    @ApiCookieAuth()
    async logoutAll(
      @Req() req: RequestWithUser,
      @Res({ passthrough: true }) response: Response,
    ) {
      try {
        const user = req.user;
        this.logger.debug('User from AccessTokenStrategy:', user);
        if (!user) {
          throw new UnauthorizedException('Invalid user credentials');
        }

        return await this.authService.logoutAll(user.id, response);
      } catch (error) {
        let message = 'Unknown error';
        if (error instanceof Error) {
          message = error.message;
        }
        this.logger.error('Logout all devices failed:', message);
        throw new UnauthorizedException('Failed to logout from all devices');
      }
    }
  
    @Get('me')
    @UseGuards(AccessTokenGuard)
    @ApiBearerAuth()
    @ApiCookieAuth()
    async getMe(
      @Req() req: RequestWithUser,
      @Res({ passthrough: true }) res: Response,
    ) {
      try {
        const user = req.user;
        this.logger.debug('User from AccessTokenStrategy:', user);
        if (!user) {
          throw new UnauthorizedException('Invalid credentials');
        }
        return {
          user,
          accessToken: req.headers['authorization']?.replace('Bearer ', ''),
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Get user info failed:', errorMessage);
        throw new UnauthorizedException('Failed to get user information');
      }
    }
  }
  
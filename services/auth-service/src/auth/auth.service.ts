import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
  Inject,
  forwardRef,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
  import { JwtService } from '@nestjs/jwt';
  import { ClientProxy } from '@nestjs/microservices';
  import { SigninDto, } from './dto/signin';
  import { SignupDto } from './dto/signup.dto';
  import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service';
  import { Response } from 'express';
  import * as bcryptjs from 'bcryptjs';
  
type CustomJwtPayload = {
  sub: string;
  email: string;
};
  
  @Injectable()
  export class AuthService {
    private readonly logger = new Logger(AuthService.name);
  
  constructor(
    private jwtService: JwtService,
    private refreshTokensService: RefreshTokensService,
    @Inject('USERS_SERVICE') private usersClient: ClientProxy,
  ) {}
  
    // Đăng ký user
  async signUp(createUserDto: SignupDto, response: Response) {
    try {
      if (!createUserDto.email) {
        throw new BadRequestException('Email is required');
      }

      const normalizedEmail = createUserDto.email.trim().toLowerCase();
      this.logger.log(`🔍 [AUTH] Checking if email exists: ${normalizedEmail}`);
      const userExistsResponse = await this.usersClient.send('users.findByEmail', { email: normalizedEmail }).toPromise();
      this.logger.log(`🔍 [AUTH] Email check response:`, userExistsResponse);
      
      let userExists = userExistsResponse;
      if (userExists && typeof userExists === 'object' && 'success' in userExists) {
        userExists = userExists.data;
      }
      if (userExists) {
        throw new BadRequestException('User already exists', {
          description: 'email',
        });
      }

      // 🚀 Gọi thẳng UsersService.create (UsersService sẽ tự hash password)
      this.logger.log(`🔍 [AUTH] Creating new user: ${createUserDto.username}`);
      const newUserResponse = await this.usersClient.send('users.create', { ...createUserDto, email: normalizedEmail }).toPromise();
      this.logger.log(`🔍 [AUTH] User creation response:`, newUserResponse);
      
      let newUser = newUserResponse;
      if (newUser && typeof newUser === 'object' && 'success' in newUser) {
        // RPC envelope
        if (newUser.success === false) {
          throw new BadRequestException(newUser.error || 'Failed to create user');
        }
        newUser = newUser.data;
      }
      if (!newUser || !newUser.id || !newUser.email) {
        throw new InternalServerErrorException('Failed to create user');
      }

      const tokens = await this.getTokens(newUser.id.toString(), newUser.email);

      // Delete all existing refresh tokens for this user before creating new one
      await this.refreshTokensService.deleteAllByUserId(newUser.id);
      
      // set cookie + lưu refresh token (hash refresh token)
      this.setTokenCookies(tokens.refreshToken, response);
      await this.refreshTokensService.create(
        newUser.id,
        await this.hashData(tokens.refreshToken),
      );

      return {
        accessToken: tokens.accessToken,
        user: newUser,
      };
    } catch (error) {
      this.logger.error(`Signup failed: ${error?.message || error}`, error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Signup failed');
    }
  }
  
  // Đăng nhập user (username/password)
  async signIn(data: SigninDto, response: Response) {
    try {
      this.logger.log(`🔍 [AUTH] Looking for user: ${data.username}`);
      const userResponse = await this.usersClient.send('users.findByUsername', { username: data.username }).toPromise();
      this.logger.log(`🔍 [AUTH] User response:`, userResponse);
      
      let user = userResponse;
      if (user && typeof user === 'object' && 'success' in user) {
        user = user.data;
      }
      if (!user)
        throw new NotFoundException('User does not exist', {
          description: 'username',
        });

      // 🚀 So sánh password sử dụng hàm có sẵn trong UsersService
      this.logger.log(`🔍 [AUTH] Comparing password for user: ${data.username}`);
      const passwordResponse = await this.usersClient.send('users.comparePassword', { password: data.password, hash: user.passwordHash }).toPromise();
      this.logger.log(`🔍 [AUTH] Password response:`, passwordResponse);
      
      let passwordMatches = passwordResponse;
      if (passwordMatches && typeof passwordMatches === 'object' && 'success' in passwordMatches) {
        passwordMatches = passwordMatches.data;
      }

      if (!passwordMatches)
        throw new UnauthorizedException('Password is incorrect', {
          description: 'password',
        });

      const tokens = await this.getTokens(user.id.toString(), user.email);

      // Delete all existing refresh tokens for this user before creating new one
      await this.refreshTokensService.deleteAllByUserId(user.id);
      
      this.setTokenCookies(tokens.refreshToken, response);
      await this.refreshTokensService.create(
        user.id,
        await this.hashData(tokens.refreshToken),
      );

      return {
        accessToken: tokens.accessToken,
        user,
      };
    } catch (error) {
      this.logger.error('Signin failed', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Signin failed');
    }
  }
  
    // Logout user
    async logout(userId: string, refreshToken: string, response: Response) {
      try {
        this.logger.debug(`Logout request for userId: ${userId}`);
        this.logger.debug(`Refresh token to delete: ${refreshToken.substring(0, 20)}...`);
        
        await this.refreshTokensService.deleteByUserIdAndToken(
          userId,
          refreshToken,
        );
        
        this.logger.debug(`Refresh token deleted for userId: ${userId}`);
        this.clearTokenCookies(response);
        
        return { message: 'Logout successful' };
      } catch (error) {
        this.logger.error('Logout failed:', error);
        throw new InternalServerErrorException('Failed to logout: ' + error);
      }
    }
  
    // Logout all sessions
    async logoutAll(userId: string, response: Response) {
      this.logger.debug(`Logout all sessions for userId: ${userId}`);
      await this.refreshTokensService.deleteAllByUserId(userId);
      this.clearTokenCookies(response);
      return { message: 'Logout from all devices successful' };
    }
  
    // Refresh token
    async refreshTokens(userId: string, refreshToken: string, res: Response) {
      this.logger.debug(`Refresh token request for userId: ${userId}`);
      
      this.logger.log(`🔍 [AUTH] Getting user by ID: ${userId}`);
      const userResponse = await this.usersClient.send('users.get', { userId }).toPromise();
      this.logger.log(`🔍 [AUTH] User response:`, userResponse);
      
      let user = userResponse;
      
      if (user && typeof user === 'object' && 'success' in user) {
        if (!user.success) {
          this.logger.warn(`User not found in RPC response: ${userId}`);
          throw new ForbiddenException('User not found');
        }
        user = user.data;
      }
      if (!user) {
        this.logger.warn(`No user data found for userId: ${userId}`);
        throw new ForbiddenException('Access Denied');
      }
      
      this.logger.debug(`User found: ${user.id}, email: ${user.email}`);
  
      const refreshTokenEntity =
        await this.refreshTokensService.findByUserIdAndToken(
          userId,
          refreshToken,
        );
  
      if (!refreshTokenEntity) {
        this.logger.warn(`No valid refresh token found for userId: ${userId}`);
        throw new ForbiddenException('Access Denied');
      }
      
      this.logger.debug(`Valid refresh token found for userId: ${userId}`);
  
      try {
        await this.jwtService.verifyAsync(refreshToken, {
          secret: process.env.JWT_SECRET,
        });
  
      const accessToken = await this.signAccessToken({
        sub: userId,
        email: user.email,
      });
  
        return { message: 'Token refreshed successfully', accessToken };
      } catch {
        const tokens = await this.getTokens(userId, user.email);
  
        this.setTokenCookies(tokens.refreshToken, res);
  
        await this.refreshTokensService.updateToken(
          refreshTokenEntity.id,
          await this.hashData(tokens.refreshToken),
        );
  
        return { message: 'Tokens refreshed successfully' };
      }
    }
  
    // Hash refresh token (AuthService chỉ còn hash refresh token)
    public async hashData(data: string): Promise<string> {
      try {
        const salt = await bcryptjs.genSalt(10);
        return bcryptjs.hash(data, salt);
      } catch (err) {
        this.logger.error('Failed to hash data', err);
        throw new InternalServerErrorException('Failed to process data');
      }
    }
  
    // Tạo access token và refresh token
  private async getTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken({ sub: userId, email }),
      this.signRefreshToken({ sub: userId, email }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
  
  private signAccessToken(accessTokenData: CustomJwtPayload) {
    return this.jwtService.signAsync(accessTokenData, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_AC_EXPIRES_IN || '1h',
    } as any);
  }
  
  private signRefreshToken(refreshTokenData: CustomJwtPayload) {
    return this.jwtService.signAsync(refreshTokenData, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_RF_EXPIRES_IN || '7d',
    } as any);
  }
  
    // Set và clear cookie refresh token
    private setTokenCookies(refreshToken: string, response: Response) {
      const maxAge =
        Number(process.env.JWT_RF_EXPIRES_IN) * 1000 || 7 * 24 * 60 * 60 * 1000;
      this.logger.debug(maxAge);
      response.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: maxAge,
      });
    }
  
    private clearTokenCookies(response: Response) {
      response.clearCookie('refresh_token', {
        path: '/',
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });
    }
  }

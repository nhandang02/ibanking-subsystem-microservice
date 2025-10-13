import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [
    AccessTokenGuard,
    RefreshTokenGuard,
    AccessTokenStrategy,
    RefreshTokenStrategy,
  ],
  exports: [
    AccessTokenGuard,
    RefreshTokenGuard,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}

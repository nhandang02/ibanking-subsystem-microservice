import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  StrategyOptionsWithRequest,
  JwtFromRequestFunction,
} from 'passport-jwt';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  email: string;
}

interface RequestWithCookies extends Request {
  cookies: {
    refresh_token?: string;
  };
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    const extractFromCookie: JwtFromRequestFunction = (
      request: RequestWithCookies,
    ): string | null => request?.cookies?.refresh_token || null;

    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([extractFromCookie]),
      secretOrKey: process.env.JWT_SECRET ?? "secret",
      passReqToCallback: true,
    };

    super(options);
  }

  validate(
    req: RequestWithCookies,
    payload: JwtPayload,
  ): JwtPayload & { refreshToken: string } {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    return {
      sub: payload.sub,
      email: payload.email,
      refreshToken,
    };
  }
}




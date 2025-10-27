import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();

    // Get client identifier (IP address or user ID)
    const identifier = this.getClientIdentifier(request);
    
    // Different rate limits for different endpoints
    const endpoint = request.route?.path || request.path;
    const { limit, windowMs } = this.getRateLimitConfig(endpoint);

    const result = await this.rateLimitService.checkRateLimit(identifier, limit, windowMs);

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      throw new HttpException(
        {
          message: 'Too many requests',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIdentifier(request: Request): string {
    // Try to get user ID from JWT token if available
    const user = (request as any).user;
    if (user?.sub) {
      return `user:${user.sub}`;
    }

    // Fallback to IP address
    const forwarded = request.headers['x-forwarded-for'];
    const ip = forwarded ? (forwarded as string).split(',')[0] : request.ip;
    return `ip:${ip}`;
  }

  private getRateLimitConfig(endpoint: string): { limit: number; windowMs: number } {
    // Different rate limits for different endpoints
    if (endpoint.includes('/auth/signin') || endpoint.includes('/auth/signup')) {
      return { limit: 50, windowMs: 15 * 60 * 1000 }; // 5 requests per 15 minutes
    }
    
    if (endpoint.includes('/otp/')) {
      return { limit: 10, windowMs: 60 * 1000 }; // 10 requests per minute
    }
    
    if (endpoint.includes('/transactions/')) {
      return { limit: 20, windowMs: 60 * 1000 }; // 20 requests per minute
    }

    // Default rate limit
    return { limit: 100, windowMs: 15 * 60 * 1000 }; // 100 requests per 15 minutes
  }
}



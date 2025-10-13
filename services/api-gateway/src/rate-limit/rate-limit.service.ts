import { Injectable, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://redis:6379',
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis for rate limiting');
    });

    this.client.connect();
  }

  async checkRateLimit(
    identifier: string,
    limit: number = 100,
    windowMs: number = 15 * 60 * 1000, // 15 minutes
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const window = Math.floor(now / windowMs);

    try {
      // Get current count
      const current = await this.client.get(`${key}:${window}`);
      const count = typeof current === 'string' ? parseInt(current, 10) : 0;

      if (count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: (window + 1) * windowMs,
        };
      }

      // Increment counter
      await this.client.incr(`${key}:${window}`);
      await this.client.expire(`${key}:${window}`, Math.ceil(windowMs / 1000));

      return {
        allowed: true,
        remaining: limit - count - 1,
        resetTime: (window + 1) * windowMs,
      };
    } catch (error) {
      this.logger.error('Rate limit check failed:', error);
      // Allow request if Redis is down
      return {
        allowed: true,
        remaining: limit,
        resetTime: now + windowMs,
      };
    }
  }

  async getClient(): Promise<RedisClientType> {
    return this.client;
  }
}



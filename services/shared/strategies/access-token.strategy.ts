import { Injectable, UnauthorizedException, Inject, Logger, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClientProxy } from '@nestjs/microservices';
import { connect } from 'amqplib';

type JwtPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(AccessTokenStrategy.name);
  private conn: any = null;
  private ch: any = null;
  private replyQueue = '';

  constructor(
    @Optional() @Inject('USERS_SERVICE') private usersClient?: ClientProxy,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET ?? 'secret',
      ignoreExpiration: false,
    } as any);
  }

  async validate(payload: JwtPayload) {
    this.logger.debug(`Validating JWT payload:`, payload);
    
    try {
      const userId = payload.sub;
      if (!userId) {
        this.logger.warn('No user ID in JWT payload');
        throw new UnauthorizedException('Token invalid');
      }

      this.logger.debug(`Getting user by ID: ${userId}`);
      
      let userResponse;
      if (this.usersClient) {
        // Use NestJS Microservices if available
        this.logger.debug('Using NestJS Microservices client');
        userResponse = await this.usersClient.send('users.get', { userId }).toPromise();
      } else {
        // Fallback to direct RabbitMQ
        this.logger.debug('Using direct RabbitMQ fallback');
        userResponse = await this.fetchUserByIdDirect(userId);
      }
      
      this.logger.debug(`User response:`, userResponse);

      if (!userResponse || !userResponse.success || !userResponse.data) {
        this.logger.warn(`User not found for ID: ${userId}`);
        throw new UnauthorizedException('User not found');
      }

      const user = userResponse.data;
      this.logger.debug(`User validated successfully:`, { id: user.id, username: user.username, email: user.email });
      
      return {
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          availableBalance: user.availableBalance,
        }
      };
    } catch (error) {
      this.logger.error(`AccessTokenGuard error: ${error.message}`);
      throw new UnauthorizedException('Token invalid, User not found');
    }
  }

  private async ensureChannel() {
    if (this.ch) return;
    const url = process.env.RABBITMQ_URL || `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASS || 'guest'}@rabbitmq:${process.env.RABBITMQ_PORT || 5672}`;
    this.conn = await connect(url);
    this.ch = await this.conn.createChannel();
    const q = await this.ch.assertQueue('', { exclusive: true });
    this.replyQueue = q.queue;
  }

  private async fetchUserByIdDirect(userId: string): Promise<any | null> {
    await this.ensureChannel();
    const ch = this.ch!;
    const correlationId = Math.random().toString(36).slice(2);

    return new Promise<any | null>(async (resolve) => {
      const { consumerTag } = await ch.consume(
        this.replyQueue,
        async (msg: any) => {
          if (!msg) return;
          if (msg.properties.correlationId === correlationId) {
            try {
              const content = JSON.parse(msg.content.toString());
              resolve(content || null);
            } catch {
              resolve(null);
            } finally {
              await ch.cancel(consumerTag);
            }
          }
        },
        { noAck: true },
      );

      ch.sendToQueue('users.get', Buffer.from(JSON.stringify({ userId })), {
        correlationId,
        replyTo: this.replyQueue,
        contentType: 'application/json',
      });

      setTimeout(async () => {
        try {
          await ch.cancel(consumerTag);
        } catch {}
        resolve(null);
      }, 2000);
    });
  }

}




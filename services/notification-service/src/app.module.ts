import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { EmailService } from './email.service';
import { RedisService } from './redis.service';
import { AuthModule } from '@ibanking/shared';

@Module({
  imports: [AuthModule],
  controllers: [NotificationController],
  providers: [NotificationService, EmailService, RedisService],
  exports: [NotificationService, EmailService],
})
export class AppModule {}

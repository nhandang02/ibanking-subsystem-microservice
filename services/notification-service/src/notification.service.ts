import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';
// import { OtpService } from './otp.service';
import { RedisService } from './redis.service';

export interface NotificationEvent {
  type: 'otp' | 'transaction_success' | 'transaction_error';
  data: {
    email: string;
    studentId?: string;
    transactionId?: string;
    paymentId?: string; // For payment-related notifications
    amount?: string;
    error?: string;
    otp?: string; // For OTP notifications
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  async handleNotificationEvent(event: NotificationEvent): Promise<void> {
    this.logger.log(`Processing notification event: ${event.type}`, event.data);

    try {
      switch (event.type) {
        case 'otp':
          if (event.data.studentId && event.data.transactionId && event.data.otp) {
            await this.handleOtpNotification(event.data as any);
          }
          break;
        case 'transaction_error':
          if (event.data.error) {
            await this.handleTransactionError(event.data as any);
          }
          break;
        default:
          this.logger.warn(`Unknown notification type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle notification event:`, error);
      throw error;
    }
  }

  private async handleOtpNotification(data: {
    email: string;
    studentId: string;
    transactionId: string;
    otp: string;
  }): Promise<void> {
    await this.emailService.sendOtpEmail(
      data.email,
      data.otp,
      data.studentId,
    );
  }

  

  private async handleTransactionError(data: {
    email: string;
    error: string;
    transactionId?: string;
  }): Promise<void> {
    await this.emailService.sendErrorNotification(
      data.email,
      data.error,
      data.transactionId,
    );

    // Note: OTP clearing is now handled by OTP service
  }

  // Rate limiting for notifications
  async checkRateLimit(email: string, type: string): Promise<boolean> {
    const key = `rate_limit:${type}:${email}`;
    const count = await this.redisService.incr(key);
    
    if (count === 1) {
      // Set expiry for first request
      await this.redisService.expire(key, 3600); // 1 hour
    }

    // Allow max 10 notifications per hour per email per type
    return count <= 10;
  }

  // Store notification history
  async storeNotificationHistory(
    email: string,
    type: string,
    data: any,
    status: 'sent' | 'failed',
  ): Promise<void> {
    const historyKey = `notification_history:${email}`;
    const notification = {
      type,
      data,
      status,
      timestamp: new Date().toISOString(),
    };

    // Store in Redis list (keep last 100 notifications)
    const client = await this.redisService.getClient();
    await client.lPush(historyKey, JSON.stringify(notification));
    await client.lTrim(historyKey, 0, 99); // Keep only last 100
    await client.expire(historyKey, 86400 * 30); // Keep for 30 days
  }

  // Saga compensation action
  async cancelNotification(notificationId: string): Promise<void> {
    this.logger.log(`Cancelling notification: ${notificationId}`);
    
    // In a real implementation, you might want to:
    // 1. Mark the notification as cancelled in the database
    // 2. Send a cancellation email if the original email was sent
    // 3. Update notification history
    
    // For now, we'll just log the cancellation
    this.logger.log(`Notification cancelled: ${notificationId}`);
    
    // You could also add logic to remove from email queue if not yet sent
    // or send a follow-up cancellation email
  }

  // Public methods for direct calls
  async sendEmail(to: string, subject: string, text: string, context?: any): Promise<void> {
    this.logger.log(`Sending email to: ${to}, subject: ${subject}`);
    try {
      await this.emailService.sendEmail(to, subject, text, context);
      this.logger.log(`Email sent successfully to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendOtpEmail(to: string, otp: string, studentId: string, transactionId?: string): Promise<void> {
    this.logger.log(`Sending OTP email to: ${to}, studentId: ${studentId}, transactionId: ${transactionId}`);
    try {
      await this.emailService.sendOtpEmail(to, otp, studentId, transactionId);
      this.logger.log(`OTP email sent successfully to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendPaymentSuccessEmail(
    to: string, 
    paymentId: string, 
    studentId: string, 
    amount: string, 
    newBalance: number, 
    completedAt: string
  ): Promise<void> {
    this.logger.log(`Sending payment success email to: ${to}, paymentId: ${paymentId}, studentId: ${studentId}`);
    try {
      await this.emailService.sendPaymentSuccessEmail(to, paymentId, studentId, amount, newBalance, completedAt);
      this.logger.log(`Payment success email sent successfully to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send payment success email to ${to}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendErrorNotification(to: string, error: string, transactionId?: string): Promise<void> {
    this.logger.log(`Sending error notification to: ${to}, error: ${error}`);
    try {
      await this.emailService.sendErrorNotification(to, error, transactionId);
      this.logger.log(`Error notification sent successfully to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send error notification to ${to}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendSms(to: string, message: string, context?: any): Promise<void> {
    this.logger.log(`Sending SMS to: ${to}, message: ${message}`);
    // TODO: Implement SMS service
    this.logger.warn('SMS service not implemented yet');
  }

  async sendNotification(to: string, type: string, data: any): Promise<void> {
    this.logger.log(`Sending notification to: ${to}, type: ${type}`);
    // Route to appropriate notification method
    switch (type) {
      case 'email':
        await this.sendEmail(to, data.subject, data.text, data.context);
        break;
      case 'otp':
        await this.sendOtpEmail(to, data.otp, data.studentId);
        break;
      case 'error':
        await this.sendErrorNotification(to, data.error, data.transactionId);
        break;
      case 'sms':
        await this.sendSms(to, data.message, data.context);
        break;
      default:
        this.logger.warn(`Unknown notification type: ${type}`);
    }
  }
}

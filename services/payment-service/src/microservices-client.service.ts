import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MicroservicesClientService implements OnModuleInit {
  private readonly logger = new Logger(MicroservicesClientService.name);
  private otpClient: ClientProxy;
  private notificationClient: ClientProxy;

  onModuleInit() {
    // Initialize OTP microservice client
    this.otpClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
        queue: 'otp_queue',
        queueOptions: {
          durable: true,
        },
      },
    });

    // Initialize Notification microservice client
    this.notificationClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
        queue: 'notification_queue',
        queueOptions: {
          durable: true,
        },
      },
    });

    this.logger.log('Microservices clients initialized');
  }

  // OTP Service RPC calls
  async generateOtp(paymentId: string, userEmail: string, studentId: string): Promise<any> {
    this.logger.log(`Calling OTP service to generate OTP for payment: ${paymentId}`);
    try {
      const result = await firstValueFrom(
        this.otpClient.send('otp.generate', { paymentId, userEmail, studentId })
      );
      this.logger.log(`OTP generation response:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to generate OTP: ${error.message}`);
      throw error;
    }
  }

  async verifyOtp(paymentId: string, otp: string): Promise<any> {
    this.logger.log(`Calling OTP service to verify OTP for payment: ${paymentId}`);
    try {
      const result = await firstValueFrom(
        this.otpClient.send('otp.verify', { paymentId, otp })
      );
      this.logger.log(`OTP verification response:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to verify OTP: ${error.message}`);
      throw error;
    }
  }

  async clearOtp(transactionId: string): Promise<any> {
    this.logger.log(`Calling OTP service to clear OTP for transaction: ${transactionId}`);
    try {
      const result = await firstValueFrom(
        this.otpClient.send('otp.clear', { transactionId })
      );
      this.logger.log(`OTP clear response:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to clear OTP: ${error.message}`);
      throw error;
    }
  }


  async getOtpInfo(transactionId: string): Promise<any> {
    this.logger.log(`Calling OTP service to get OTP info for transaction: ${transactionId}`);
    try {
      const result = await firstValueFrom(
        this.otpClient.send('otp.info', { transactionId })
      );
      this.logger.log(`OTP info response:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get OTP info: ${error.message}`);
      throw error;
    }
  }


  async verifyOtpUsed(paymentId: string): Promise<any> {
    this.logger.log(`Calling OTP service to verify OTP was used for payment: ${paymentId}`);
    try {
      const result = await firstValueFrom(
        this.otpClient.send('otp.verify-used', { paymentId })
      );
      this.logger.log(`OTP usage verification response:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to verify OTP usage: ${error.message}`);
      throw error;
    }
  }

  // Notification Service RPC calls
  async sendNotification(type: string, recipient: string, subject: string, content: string, metadata?: any): Promise<any> {
    this.logger.log(`Calling Notification service to send ${type} notification to ${recipient}`);
    try {
      const result = await firstValueFrom(
        this.notificationClient.send('notification.send', { type, recipient, subject, content, metadata })
      );
      this.logger.log(`Notification send response:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, content: string, metadata?: any): Promise<any> {
    this.logger.log(`Calling Notification service to send email to ${to}`);
    try {
      const result = await firstValueFrom(
        this.notificationClient.send('notification.send-email', { to, subject, content, metadata })
      );
      this.logger.log(`Email send response:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  async sendMessageToNotificationService(message: any): Promise<any> {
    this.logger.log(`Sending message to Notification service:`, message);
    try {
      const result = await firstValueFrom(
        this.notificationClient.send('otp.generated', message)
      );
      this.logger.log(`Notification service response:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send message to notification service: ${error.message}`);
      throw error;
    }
  }

  async sendSms(to: string, message: string, metadata?: any): Promise<any> {
    this.logger.log(`Calling Notification service to send SMS to ${to}`);
    try {
      const result = await firstValueFrom(
        this.notificationClient.send('notification.send-sms', { to, message, metadata })
      );
      this.logger.log(`SMS send response:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      throw error;
    }
  }

  // Event publishing methods
  async publishOtpGenerated(email: string, otp: string, studentId: string, transactionId: string): Promise<void> {
    this.logger.log(`Publishing OtpGenerated event for transaction: ${transactionId}`);
    try {
      this.otpClient.emit('otp.generated', {
        type: 'OtpGenerated',
        data: { email, otp, studentId, transactionId }
      });
      this.logger.log(`OtpGenerated event published successfully`);
    } catch (error) {
      this.logger.error(`Failed to publish OtpGenerated event: ${error.message}`);
      throw error;
    }
  }

  async publishPaymentCreated(paymentId: string, userEmail: string, studentId: string, amount: number): Promise<void> {
    this.logger.log(`Publishing PaymentCreated event for payment: ${paymentId}`);
    try {
      this.notificationClient.emit('payment.created', {
        type: 'PaymentCreated',
        data: { paymentId, userEmail, studentId, amount }
      });
      this.logger.log(`PaymentCreated event published successfully`);
    } catch (error) {
      this.logger.error(`Failed to publish PaymentCreated event: ${error.message}`);
      throw error;
    }
  }

  async publishPaymentCompleted(paymentId: string, userEmail: string, studentId: string, amount: number): Promise<void> {
    this.logger.log(`Publishing PaymentCompleted event for payment: ${paymentId}`);
    try {
      this.notificationClient.emit('payment.completed', {
        type: 'PaymentCompleted',
        data: { paymentId, userEmail, studentId, amount }
      });
      this.logger.log(`PaymentCompleted event published successfully`);
    } catch (error) {
      this.logger.error(`Failed to publish PaymentCompleted event: ${error.message}`);
      throw error;
    }
  }

  async publishPaymentFailed(paymentId: string, userEmail: string, studentId: string, amount: number, reason: string): Promise<void> {
    this.logger.log(`Publishing PaymentFailed event for payment: ${paymentId}`);
    try {
      this.notificationClient.emit('payment.failed', {
        type: 'PaymentFailed',
        data: { paymentId, userEmail, studentId, amount, reason }
      });
      this.logger.log(`PaymentFailed event published successfully`);
    } catch (error) {
      this.logger.error(`Failed to publish PaymentFailed event: ${error.message}`);
      throw error;
    }
  }

  async publishPaymentCancelled(paymentId: string, userEmail: string, studentId: string, amount: number): Promise<void> {
    this.logger.log(`Publishing PaymentCancelled event for payment: ${paymentId}`);
    try {
      this.notificationClient.emit('payment.cancelled', {
        type: 'PaymentCancelled',
        data: { paymentId, userEmail, studentId, amount }
      });
      this.logger.log(`PaymentCancelled event published successfully`);
    } catch (error) {
      this.logger.error(`Failed to publish PaymentCancelled event: ${error.message}`);
      throw error;
    }
  }

  // Generic event publisher
  async publishEvent(eventType: string, eventData: any): Promise<void> {
    this.logger.log(`Publishing event: ${eventType}`);
    try {
      // Route events to appropriate service based on event type
      if (eventType.startsWith('otp.')) {
        await this.otpClient.emit(eventType, eventData);
        this.logger.log(`${eventType} event published to OTP service successfully`);
      } else {
        await this.notificationClient.emit(eventType, eventData);
        this.logger.log(`${eventType} event published to Notification service successfully`);
      }
    } catch (error) {
      this.logger.error(`Failed to publish ${eventType} event: ${error.message}`);
      throw error;
    }
  }
}

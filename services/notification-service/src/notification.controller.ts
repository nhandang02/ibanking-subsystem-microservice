import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  // RPC Patterns for direct notification sending
  @MessagePattern('notification.send')
  async sendNotification(@Payload() data: { 
    type: string; 
    recipient: string; 
    subject: string; 
    content: string; 
    metadata?: any 
  }) {
    this.logger.log(`Sending ${data.type} notification to ${data.recipient}`);
    try {
      const result = await this.notificationService.sendNotification(
        data.recipient,
        data.type,
        {
          subject: data.subject,
          text: data.content,
          context: data.metadata
        }
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('notification.send-email')
  async sendEmail(@Payload() data: { 
    to: string; 
    subject: string; 
    content: string; 
    metadata?: any 
  }) {
    this.logger.log(`Sending email to ${data.to}`);
    try {
      const result = await this.notificationService.sendEmail(
        data.to,
        data.subject,
        data.content,
        data.metadata
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('notification.send-sms')
  async sendSms(@Payload() data: { 
    to: string; 
    message: string; 
    metadata?: any 
  }) {
    this.logger.log(`Sending SMS to ${data.to}`);
    try {
      const result = await this.notificationService.sendSms(
        data.to,
        data.message,
        data.metadata
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Message Patterns for domain events
  @MessagePattern('otp.generated')
  async handleOtpGenerated(@Payload() event: { type: string; data: any }) {
    this.logger.log(`📧 [NOTIFICATION_SERVICE] Received OtpGenerated event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'OtpGenerated') {
        const { email, otp, studentId, transactionId } = event.data;
        
        this.logger.log(`📋 [NOTIFICATION_SERVICE] Processing OTP email:`, {
          email,
          studentId,
          transactionId,
          otp: otp
        });
        
        this.logger.log(`📤 [NOTIFICATION_SERVICE] Sending OTP email to: ${email}`);
        await this.notificationService.sendOtpEmail(email, otp, studentId, transactionId);
        
        this.logger.log(`✅ [NOTIFICATION_SERVICE] OTP email sent successfully to ${email}`);
      } else {
        this.logger.warn(`⚠️ [NOTIFICATION_SERVICE] Received event with unexpected type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`💥 [NOTIFICATION_SERVICE] Failed to process OtpGenerated event: ${error.message}`);
    }
  }


  @EventPattern('payment.completed')
  async handlePaymentCompleted(@Payload() event: { type: string; data: any }) {
    this.logger.log(`🎉 [NOTIFICATION_SERVICE] Received PaymentCompleted event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'PaymentCompleted') {
        const { userEmail, studentId, amount, paymentId, newBalance, completedAt } = event.data;
        this.logger.log(`🎉 [NOTIFICATION_SERVICE] Processing payment completed email:`, {
          userEmail,
          paymentId,
          studentId,
          amount,
          newBalance
        });
        
        // Send payment success email using the new professional template
        await this.notificationService.sendPaymentSuccessEmail(
          userEmail, 
          paymentId, 
          studentId, 
          amount, 
          newBalance, 
          completedAt
        );
        this.logger.log(`✅ [NOTIFICATION_SERVICE] Payment completed email sent successfully to ${userEmail}`);
      } else {
        this.logger.warn(`⚠️ [NOTIFICATION_SERVICE] Received event with unexpected type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`💥 [NOTIFICATION_SERVICE] Failed to process PaymentCompleted event: ${error.message}`);
    }
  }

  @EventPattern('payment.failed')
  async handlePaymentFailed(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received PaymentFailed event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'PaymentFailed') {
        const { userEmail, studentId, amount, paymentId, reason } = event.data;
        
        const subject = 'Payment Failed';
        const content = `
          <h2>Payment Failed</h2>
          <p>Your payment could not be completed.</p>
          <p>Payment ID: ${paymentId}</p>
          <p>Student ID: ${studentId}</p>
          <p>Amount: ${amount} VND</p>
          <p>Reason: ${reason}</p>
          <p>Please try again or contact support.</p>
        `;
        
        await this.notificationService.sendEmail(userEmail, subject, content, {
          paymentId,
          studentId,
          amount,
          reason,
          type: 'payment_failed'
        });
        
        this.logger.log(`Payment failed email sent to ${userEmail}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process PaymentFailed event: ${error.message}`);
    }
  }

  @EventPattern('payment.cancelled')
  async handlePaymentCancelled(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received PaymentCancelled event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'PaymentCancelled') {
        const { userEmail, studentId, amount, paymentId } = event.data;
        
        // Create error message based on the cancellation reason
        const errorMessage = `Thanh toán học phí cho sinh viên ${studentId} với số tiền ${amount.toLocaleString()} VNĐ đã bị hủy do vượt quá số lần nhập sai OTP (5 lần).`;
        
        await this.notificationService.sendErrorNotification(userEmail, errorMessage, paymentId);
        
        this.logger.log(`Payment cancelled email sent to ${userEmail}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process PaymentCancelled event: ${error.message}`);
    }
  }
}

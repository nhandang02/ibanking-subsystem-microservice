import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { OtpService } from './otp.service';

@Controller()
export class OtpController {
  private readonly logger = new Logger(OtpController.name);

  constructor(private readonly otpService: OtpService) {}

  // RPC Patterns for Payment Service communication
  @MessagePattern('otp.generate')
  async generateOtp(@Payload() data: { paymentId: string; userEmail: string; studentId: string }) {
    this.logger.log(`Generating OTP for payment: ${data.paymentId}`);
    try {
      const otp = await this.otpService.generateOtp(data.userEmail, data.studentId, data.paymentId);
      return { success: true, data: { otp } };
    } catch (error) {
      this.logger.error(`Failed to generate OTP: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('otp.verify')
  async verifyOtp(@Payload() data: { paymentId: string; otp: string }) {
    this.logger.log(`Verifying OTP for payment: ${data.paymentId}`);
    try {
      const isValid = await this.otpService.verifyOtp(data.paymentId, data.otp);
      return { success: true, data: { isValid } };
    } catch (error) {
      this.logger.error(`Failed to verify OTP: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('otp.clear')
  async clearOtp(@Payload() data: { transactionId: string }) {
    this.logger.log(`Clearing OTP for transaction: ${data.transactionId}`);
    try {
      await this.otpService.clearOtp(data.transactionId);
      return { success: true, data: { cleared: true } };
    } catch (error) {
      this.logger.error(`Failed to clear OTP: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('otp.info')
  async getOtpInfo(@Payload() data: { transactionId: string }) {
    this.logger.log(`Getting OTP info for transaction: ${data.transactionId}`);
    try {
      const otpInfo = await this.otpService.getOtpInfo(data.transactionId);
      return { success: true, data: otpInfo };
    } catch (error) {
      this.logger.error(`Failed to get OTP info: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('otp.verify-used')
  async verifyOtpUsed(@Payload() data: { paymentId: string }) {
    this.logger.log(`Verifying OTP was used for payment: ${data.paymentId}`);
    try {
      const isUsed = await this.otpService.verifyOtpUsed(data.paymentId);
      return { success: true, data: isUsed };
    } catch (error) {
      this.logger.error(`Failed to verify OTP usage: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @EventPattern('payment.completed')
  async handlePaymentCompleted(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received PaymentCompleted event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'PaymentCompleted') {
        const { paymentId } = event.data;
        await this.otpService.clearOtp(paymentId);
        this.logger.log(`OTP cleared for completed payment ${paymentId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process PaymentCompleted event: ${error.message}`);
    }
  }

  @EventPattern('payment.cancelled')
  async handlePaymentCancelled(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received PaymentCancelled event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'PaymentCancelled') {
        const { paymentId } = event.data;
        await this.otpService.clearOtp(paymentId);
        this.logger.log(`OTP cleared for cancelled payment ${paymentId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process PaymentCancelled event: ${error.message}`);
    }
  }

  // Event handler for OTP resend requests
  @EventPattern('otp.resend_requested')
  async handleOtpResendRequested(@Payload() event: { type: string; data: any }) {
    this.logger.log(`📨 [OTP_CONTROLLER] Received OtpResendRequested event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'OtpResendRequested') {
        const { email, studentId, transactionId } = event.data;
        this.logger.log(`🔄 [OTP_CONTROLLER] Processing resend request:`, {
          email,
          studentId,
          transactionId
        });
        
        // Generate new OTP and send email
        const newOtp = await this.otpService.generateNewOtpAndSendEmail(email, studentId, transactionId);
        this.logger.log(`✅ [OTP_CONTROLLER] OTP regenerated and email sent for transaction ${transactionId}`);
      } else {
        this.logger.warn(`⚠️ [OTP_CONTROLLER] Received event with unexpected type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`💥 [OTP_CONTROLLER] Failed to process OtpResendRequested event: ${error.message}`);
    }
  }

}

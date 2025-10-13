import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { RedisService } from './redis.service';
import { connect } from 'amqplib';
import { OtpExpiredException } from './exceptions/otp-expired.exception';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRY = 2 * 60; // 2 minutes in second2
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    private readonly redisService: RedisService,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
  ) {}

  async generateOtp(
    email: string,
    studentId: string,
    transactionId: string,
    skipExistingCheck: boolean = false,
  ): Promise<string> {
    this.logger.log(`🔐 [OTP_SERVICE] Starting OTP generation process`);
    this.logger.log(`📋 [OTP_SERVICE] OTP data:`, {
      email,
      studentId,
      transactionId,
      skipExistingCheck
    });

    // Check if OTP already exists for this transaction (unless skip check is requested)
    if (!skipExistingCheck) {
      this.logger.log(`🔍 [OTP_SERVICE] Checking for existing OTP...`);
      const existingOtp = await this.redisService.get(`otp:${transactionId}`);
      if (existingOtp) {
        this.logger.error(`❌ [OTP_SERVICE] OTP already exists for transaction: ${transactionId}`);
        throw new BadRequestException('OTP already sent for this transaction');
      }
    } else {
      this.logger.log(`⏭️ [OTP_SERVICE] Skipping existing OTP check (regenerate/resend mode)`);
    }

    // Generate 6-digit OTP
    this.logger.log(`🎲 [OTP_SERVICE] Generating 6-digit OTP...`);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.logger.log(`✅ [OTP_SERVICE] OTP generated: ${otp}`);

    // Store OTP in Redis with expiry
    this.logger.log(`💾 [OTP_SERVICE] Storing OTP in Redis with ${this.OTP_EXPIRY}s expiry...`);
    await this.redisService.set(
      `otp:${transactionId}`,
      JSON.stringify({
        code: otp,
        email,
        studentId,
        attempts: 0,
        createdAt: new Date().toISOString(),
      }),
      this.OTP_EXPIRY,
    );

    // Publish OTP to notification service via RabbitMQ
    this.logger.log(`📡 [OTP_SERVICE] Publishing OtpGenerated event...`);
    await this.publishOtpEvent(email, otp, studentId, transactionId);

    this.logger.log(`🎉 [OTP_SERVICE] OTP generation completed for transaction ${transactionId}`);
    return otp;
  }

  async verifyOtp(transactionId: string, inputOtp: string): Promise<boolean> {
    const otpData = await this.redisService.get(`otp:${transactionId}`);
    if (!otpData) {
      // OTP not found - could be expired or never existed
      throw new BadRequestException('OTP_EXPIRED: OTP not found or expired');
    }

    const parsed = JSON.parse(otpData);
    
    // Check if OTP has expired
    if (this.isOtpExpired(parsed.createdAt)) {
      await this.redisService.del(`otp:${transactionId}`);
      throw new BadRequestException('OTP_EXPIRED: OTP has expired');
    }
    
    // Verify OTP first (before incrementing attempts)
    if (parsed.code === inputOtp) {
      // OTP is correct, mark as verified and keep in Redis for transaction service to check
      parsed.verified = true;
      await this.redisService.set(
        `otp:${transactionId}`,
        JSON.stringify(parsed),
        this.OTP_EXPIRY,
      );
      this.logger.log(`OTP verified successfully for transaction ${transactionId}`);
      return true;
    }

    // OTP is incorrect, increment attempts
    parsed.attempts += 1;
    
    // Check if this was the last attempt (attempt 5)
    if (parsed.attempts >= this.MAX_ATTEMPTS) {
      await this.redisService.del(`otp:${transactionId}`);
      // Publish payment cancellation event
      await this.publishPaymentCancellationEvent(transactionId, 'Maximum OTP attempts exceeded');
      this.logger.warn(`OTP verification failed for transaction ${transactionId}, attempt ${parsed.attempts} - MAX ATTEMPTS REACHED`);
      throw new BadRequestException('OTP_MAX_ATTEMPTS: Maximum OTP attempts exceeded. Payment cancelled.');
    }
    
    // Save updated attempts count
    await this.redisService.set(
      `otp:${transactionId}`,
      JSON.stringify(parsed),
      this.OTP_EXPIRY,
    );

    this.logger.warn(`OTP verification failed for transaction ${transactionId}, attempt ${parsed.attempts}`);
    return false;
  }

  async getOtpInfo(transactionId: string): Promise<any> {
    const otpData = await this.redisService.get(`otp:${transactionId}`);
    if (!otpData) {
      return null;
    }

    const parsed = JSON.parse(otpData);
    return {
      email: parsed.email,
      studentId: parsed.studentId,
      attempts: parsed.attempts,
      createdAt: parsed.createdAt,
    };
  }

  // Unified method for both resend and regenerate OTP
  async resendOtp(transactionId: string): Promise<string> {
    this.logger.log(`🔄 [OTP_SERVICE] Starting OTP resend process for transaction: ${transactionId}`);
    
    const otpData = await this.redisService.get(`otp:${transactionId}`);
    if (!otpData) {
      this.logger.error(`❌ [OTP_SERVICE] OTP not found for transaction: ${transactionId}`);
      throw new BadRequestException('OTP not found or expired');
    }

    const parsed = JSON.parse(otpData);
    this.logger.log(`📋 [OTP_SERVICE] Found existing OTP data:`, {
      email: parsed.email,
      studentId: parsed.studentId,
      attempts: parsed.attempts,
      createdAt: parsed.createdAt
    });
    
    // Check if OTP has expired
    this.logger.log(`🔍 [OTP_SERVICE] Checking if OTP has expired...`);
    if (this.isOtpExpired(parsed.createdAt)) {
      this.logger.error(`❌ [OTP_SERVICE] OTP has expired for transaction: ${transactionId}`);
      await this.redisService.del(`otp:${transactionId}`);
      throw new OtpExpiredException(transactionId);
    }
    
    // Publish resend OTP event instead of direct method call
    this.logger.log(`📡 [OTP_SERVICE] Publishing OtpResendRequested event...`);
    await this.publishOtpResendEvent(parsed.email, parsed.studentId, transactionId);
    
    this.logger.log(`✅ [OTP_SERVICE] OtpResendRequested event published for transaction ${transactionId}`);
    return 'Event published - OTP will be regenerated and sent via event handler';
  }

  async regenerateOtpForTransaction(
    transactionId: string,
    email: string,
    studentId: string,
  ): Promise<string> {
    this.logger.log(`🔄 [OTP_SERVICE] Starting OTP regeneration for transaction: ${transactionId}`);
    
    // Clear existing OTP if any
    this.logger.log(`🗑️ [OTP_SERVICE] Clearing existing OTP...`);
    await this.clearOtp(transactionId);
    
    // Wait a bit to ensure Redis is cleared
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate new OTP and send email
    return await this.generateNewOtpAndSendEmail(email, studentId, transactionId);
  }

  // Common method to generate new OTP and send email
  async generateNewOtpAndSendEmail(
    email: string,
    studentId: string,
    transactionId: string,
  ): Promise<string> {
    this.logger.log(`🆕 [OTP_SERVICE] Generating new OTP and sending email...`);
    
    // Reuse existing generateOtp method which already handles:
    // - OTP generation
    // - Redis storage
    // - Email sending via publishOtpEvent
    // Skip existing check since we're regenerating/resending
    const newOtp = await this.generateOtp(email, studentId, transactionId, true);
    
    this.logger.log(`🎉 [OTP_SERVICE] New OTP generated and email sent for transaction ${transactionId}`);
    return newOtp;
  }

  private isOtpExpired(createdAt: string): boolean {
    const createdTime = new Date(createdAt).getTime();
    const currentTime = new Date().getTime();
    const expiryTime = this.OTP_EXPIRY * 1000; // Convert to milliseconds
    
    return (currentTime - createdTime) > expiryTime;
  }

  async clearOtp(transactionId: string): Promise<void> {
    this.logger.log(`Clearing OTP for transaction: ${transactionId}`);
    
    const otpData = await this.redisService.get(`otp:${transactionId}`);
    if (otpData) {
      await this.redisService.del(`otp:${transactionId}`);
      this.logger.log(`OTP cleared for transaction: ${transactionId}`);
    } else {
      this.logger.warn(`No OTP found for transaction: ${transactionId}`);
    }
  }

  async verifyOtpUsed(paymentId: string): Promise<boolean> {
    // Check if OTP was used for this payment
    const otpData = await this.redisService.get(`otp:${paymentId}`);
    if (!otpData) {
      return false;
    }

    const parsed = JSON.parse(otpData);
    // If OTP exists and was verified, it means it was used
    return parsed.verified === true;
  }

  private async publishOtpEvent(
    email: string,
    otp: string,
    studentId: string,
    transactionId: string,
  ): Promise<void> {
    this.logger.log(`📡 [OTP_SERVICE] Sending OtpGenerated message to notification service...`);
    try {
      const event = {
        type: 'OtpGenerated',
        data: {
          email,
          studentId,
          transactionId,
          otp,
        },
      };

      this.logger.log(`📤 [OTP_SERVICE] Sending message:`, event);
      
      // Use microservice client to send message to notification service
      const result = await this.notificationClient.send('otp.generated', event).toPromise();
      
      this.logger.log(`✅ [OTP_SERVICE] OtpGenerated message sent successfully for transaction ${transactionId}:`, result);
    } catch (error) {
      this.logger.error(`💥 [OTP_SERVICE] Failed to send OTP message:`, error);
      throw error;
    }
  }

  private async publishOtpResendEvent(
    email: string,
    studentId: string,
    transactionId: string,
  ): Promise<void> {
    this.logger.log(`📡 [OTP_SERVICE] Publishing OtpResendRequested event...`);
    try {
      const event = {
        type: 'OtpResendRequested',
        data: {
          email,
          studentId,
          transactionId,
        },
      };

      this.logger.log(`📤 [OTP_SERVICE] Publishing resend event:`, event);
      
      // Publish event to trigger OTP regeneration
      await this.notificationClient.emit('otp.resend_requested', event);
      
      this.logger.log(`✅ [OTP_SERVICE] OtpResendRequested event published successfully for transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(`💥 [OTP_SERVICE] Failed to publish OTP resend event:`, error);
      throw error;
    }
  }

  // Rate limiting for OTP generation
  async checkOtpRateLimit(email: string): Promise<boolean> {
    const key = `otp_rate_limit:${email}`;
    const count = await this.redisService.incr(key);
    
    if (count === 1) {
      // Set expiry for first request (1 hour)
      await this.redisService.expire(key, 3600);
    }

    // Allow max 5 OTP requests per hour per email
    return count <= 5;
  }

  private async publishPaymentCancellationEvent(
    transactionId: string,
    reason: string,
  ): Promise<void> {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
      const conn = await connect(url);
      const ch = await conn.createChannel();

      await ch.assertExchange('payments', 'topic', { durable: true });

      const event = {
        type: 'PaymentCancelled',
        data: {
          paymentId: transactionId,
          reason: reason,
          cancelledAt: new Date().toISOString(),
        },
      };

      ch.publish('payments', 'payment.cancelled', Buffer.from(JSON.stringify(event)));
      this.logger.log(`Payment cancellation event published for transaction ${transactionId}`);

      await ch.close();
      await conn.close();
    } catch (error) {
      this.logger.error(`Failed to publish payment cancellation event: ${error.message}`);
    }
  }

}


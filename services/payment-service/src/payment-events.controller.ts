import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PaymentService } from './payment.service';
import { MicroservicesClientService } from './microservices-client.service';

@Controller()
export class PaymentEventsController {
  private readonly logger = new Logger(PaymentEventsController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly microservicesClient: MicroservicesClientService,
  ) {}

  // Handle OTP verification events
  @EventPattern('otp.verified')
  async handleOtpVerified(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received OtpVerified event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'OtpVerified') {
        const { paymentId, isValid } = event.data;
        
        if (isValid) {
          // OTP is valid, proceed with payment completion
          await this.paymentService.completePayment(paymentId);
          this.logger.log(`Payment ${paymentId} completed after OTP verification`);
          
          // Publish payment completed event
          const payment = await this.paymentService.getPaymentById(paymentId);
          if (payment) {
            await this.microservicesClient.publishPaymentCompleted(
              paymentId,
              payment.payerId,
              payment.studentId,
              parseFloat(payment.tuitionAmount)
            );
          }
        } else {
          // OTP is invalid, mark payment as failed
          await this.paymentService.failPayment(paymentId, 'Invalid OTP');
          this.logger.log(`Payment ${paymentId} failed due to invalid OTP`);
          
          // Publish payment failed event
          const payment = await this.paymentService.getPaymentById(paymentId);
          if (payment) {
            await this.microservicesClient.publishPaymentFailed(
              paymentId,
              payment.payerId,
              payment.studentId,
              parseFloat(payment.tuitionAmount),
              'Invalid OTP'
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process OtpVerified event: ${error.message}`);
    }
  }

  // Handle OTP expired events
  @EventPattern('otp.expired')
  async handleOtpExpired(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received OtpExpired event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'OtpExpired') {
        const { paymentId } = event.data;
        
        // Mark payment as failed due to OTP expiry
        await this.paymentService.failPayment(paymentId, 'OTP expired');
        this.logger.log(`Payment ${paymentId} failed due to OTP expiry`);
        
        // Publish payment failed event
        const payment = await this.paymentService.getPaymentById(paymentId);
        if (payment) {
          await this.microservicesClient.publishPaymentFailed(
            paymentId,
            payment.payerId,
            payment.studentId,
            parseFloat(payment.tuitionAmount),
            'OTP expired'
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process OtpExpired event: ${error.message}`);
    }
  }

  // Handle user balance updated events
  @EventPattern('user.balance.updated')
  async handleUserBalanceUpdated(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received UserBalanceUpdated event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'UserBalanceUpdated') {
        const { userId, newBalance, previousBalance } = event.data;
        
        // Check if there are any pending payments for this user
        const pendingPayments = await this.paymentService.getPendingPaymentsByPayer(userId);
        
        for (const payment of pendingPayments) {
          if (newBalance >= parseFloat(payment.tuitionAmount)) {
            // User now has sufficient balance, notify them
            await this.microservicesClient.sendEmail(
              payment.payerId,
              'Payment Can Now Be Completed',
              `Your payment for ${parseFloat(payment.tuitionAmount)} VND can now be completed. Please verify your OTP to proceed.`,
              {
                paymentId: payment.id,
                studentId: payment.studentId,
                amount: parseFloat(payment.tuitionAmount),
                type: 'balance_sufficient'
              }
            );
            
            this.logger.log(`Notified user ${userId} that payment ${payment.id} can be completed`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process UserBalanceUpdated event: ${error.message}`);
    }
  }

  // Handle user balance insufficient events
  @EventPattern('user.balance.insufficient')
  async handleUserBalanceInsufficient(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received UserBalanceInsufficient event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'UserBalanceInsufficient') {
        const { userId, requiredAmount, currentBalance } = event.data;
        
        // Get user's pending payments
        const pendingPayments = await this.paymentService.getPendingPaymentsByPayer(userId);
        
        for (const payment of pendingPayments) {
          if (parseFloat(payment.tuitionAmount) > currentBalance) {
            // Mark payment as failed due to insufficient balance
            await this.paymentService.failPayment(payment.id, 'Insufficient balance');
            
            // Publish payment failed event
            await this.microservicesClient.publishPaymentFailed(
              payment.id,
              payment.payerId,
              payment.studentId,
              parseFloat(payment.tuitionAmount),
              'Insufficient balance'
            );
            
            this.logger.log(`Payment ${payment.id} failed due to insufficient balance`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process UserBalanceInsufficient event: ${error.message}`);
    }
  }

  // Handle student validation events
  @EventPattern('student.validated')
  async handleStudentValidated(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received StudentValidated event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'StudentValidated') {
        const { studentId, isValid, reason } = event.data;
        
        if (!isValid) {
          // Get pending payments for this student
          const pendingPayments = await this.paymentService.getPendingPaymentsByStudent(studentId);
          
          for (const payment of pendingPayments) {
            // Mark payment as failed due to invalid student
            await this.paymentService.failPayment(payment.id, `Invalid student: ${reason}`);
            
            // Publish payment failed event
            await this.microservicesClient.publishPaymentFailed(
              payment.id,
              payment.payerId,
              payment.studentId,
              parseFloat(payment.tuitionAmount),
              `Invalid student: ${reason}`
            );
            
            this.logger.log(`Payment ${payment.id} failed due to invalid student: ${reason}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process StudentValidated event: ${error.message}`);
    }
  }

  // Handle payment timeout events
  @EventPattern('payment.timeout')
  async handlePaymentTimeout(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received PaymentTimeout event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'PaymentTimeout') {
        const { paymentId } = event.data;
        
        // Mark payment as failed due to timeout
        await this.paymentService.failPayment(paymentId, 'Payment timeout');
        this.logger.log(`Payment ${paymentId} failed due to timeout`);
        
        // Publish payment failed event
        const payment = await this.paymentService.getPaymentById(paymentId);
        if (payment) {
          await this.microservicesClient.publishPaymentFailed(
            paymentId,
            payment.payerId,
            payment.studentId,
            parseFloat(payment.tuitionAmount),
            'Payment timeout'
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process PaymentTimeout event: ${error.message}`);
    }
  }

  // Handle saga compensation events
  @EventPattern('saga.compensate')
  async handleSagaCompensation(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received SagaCompensation event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'SagaCompensation') {
        const { sagaId, paymentId, reason } = event.data;
        
        // Cancel the payment
        await this.paymentService.cancelPayment(paymentId, reason);
        this.logger.log(`Payment ${paymentId} cancelled due to saga compensation: ${reason}`);
        
        // Publish payment cancelled event
        const payment = await this.paymentService.getPaymentById(paymentId);
        if (payment) {
          await this.microservicesClient.publishPaymentCancelled(
            paymentId,
            payment.payerId,
            payment.studentId,
            parseFloat(payment.tuitionAmount)
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process SagaCompensation event: ${error.message}`);
    }
  }

  // Handle external payment gateway events
  @EventPattern('payment.gateway.response')
  async handlePaymentGatewayResponse(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received PaymentGatewayResponse event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'PaymentGatewayResponse') {
        const { paymentId, status, transactionId, error } = event.data;
        
        if (status === 'success') {
          // Payment gateway confirmed success
          await this.paymentService.completePayment(paymentId);
          this.logger.log(`Payment ${paymentId} completed via gateway: ${transactionId}`);
          
          // Publish payment completed event
          const payment = await this.paymentService.getPaymentById(paymentId);
          if (payment) {
            await this.microservicesClient.publishPaymentCompleted(
              paymentId,
              payment.payerId,
              payment.studentId,
              parseFloat(payment.tuitionAmount)
            );
          }
        } else {
          // Payment gateway reported failure
          await this.paymentService.failPayment(paymentId, `Gateway error: ${error}`);
          this.logger.log(`Payment ${paymentId} failed via gateway: ${error}`);
          
          // Publish payment failed event
          const payment = await this.paymentService.getPaymentById(paymentId);
          if (payment) {
            await this.microservicesClient.publishPaymentFailed(
              paymentId,
              payment.payerId,
              payment.studentId,
              parseFloat(payment.tuitionAmount),
              `Gateway error: ${error}`
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process PaymentGatewayResponse event: ${error.message}`);
    }
  }

  // Handle payment cancellation from OTP Service (when max attempts exceeded)
  @EventPattern('payment.cancelled')
  async handlePaymentCancelled(@Payload() event: { type: string; data: any }) {
    this.logger.log(`Received PaymentCancelled event: ${JSON.stringify(event)}`);
    try {
      if (event.type === 'PaymentCancelled') {
        const { paymentId, reason } = event.data;
        
        // Cancel the payment
        await this.paymentService.cancelPayment(paymentId, reason);
        this.logger.log(`Payment ${paymentId} cancelled due to: ${reason}`);
        
        // Update saga status to failed if exists
        const saga = await this.paymentService.getSagaByPaymentId(paymentId);
        if (saga && saga.status === 'pending') {
          await this.paymentService.updateSagaStatus(saga.id, 'failed', reason);
        }
        
        // Release Redis lock
        const payment = await this.paymentService.getPaymentById(paymentId);
        if (payment) {
          await this.paymentService.releaseLockPublic(payment.studentId);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process PaymentCancelled event: ${error.message}`);
    }
  }
}

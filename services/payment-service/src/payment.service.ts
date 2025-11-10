import { Injectable, Logger, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Payment } from './entities/payment.entity';
import { Saga } from './entities/saga.entity';
import { MicroservicesClientService } from './microservices-client.service';
import { connect } from 'amqplib';
import { createClient } from 'redis';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private redisClient: any;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Saga)
    private readonly sagaRepository: Repository<Saga>,
    private readonly microservicesClient: MicroservicesClientService,
  ) {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://ibanking_redis:6379'
      });
      
      this.redisClient.on('error', (err) => {
        this.logger.error('Redis Client Error:', err);
      });
      
      await this.redisClient.connect();
      this.logger.log('✅ Redis client connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to Redis:', error);
    }
  }

  // Distributed Locking Methods
  private async acquireLock(studentId: string, timeoutMs: number = 30000): Promise<boolean> {
    if (!this.redisClient) {
      this.logger.warn('Redis client not available, skipping lock');
      return true; // Allow operation if Redis is down
    }

    const lockKey = `payment_lock:${studentId}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    
    try {
      // Try to acquire lock with expiration
      const result = await this.redisClient.set(lockKey, lockValue, {
        PX: timeoutMs, // Expire after timeout
        NX: true       // Only set if not exists
      });
      
      if (result === 'OK') {
        this.logger.log(`🔒 [LOCK] Acquired lock for student ${studentId}`);
        return true;
      } else {
        this.logger.warn(`🔒 [LOCK] Failed to acquire lock for student ${studentId} - already locked`);
        return false;
      }
    } catch (error) {
      this.logger.error(`🔒 [LOCK] Error acquiring lock for student ${studentId}:`, error);
      return false;
    }
  }

  private async releaseLock(studentId: string): Promise<void> {
    if (!this.redisClient) return;

    const lockKey = `payment_lock:${studentId}`;
    
    try {
      await this.redisClient.del(lockKey);
      this.logger.log(`🔓 [LOCK] Released lock for student ${studentId}`);
    } catch (error) {
      this.logger.error(`🔓 [LOCK] Error releasing lock for student ${studentId}:`, error);
    }
  }

  private async waitForLock(studentId: string, maxWaitMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms
    
    while (Date.now() - startTime < maxWaitMs) {
      const acquired = await this.acquireLock(studentId);
      if (acquired) {
        return true;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    return false;
  }

  // Cleanup timeout payments - runs every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupTimeoutPayments() {
    this.logger.log('🧹 [CLEANUP] Starting cleanup of timeout payments...');
    
    try {
      const twoMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 3 minutes ago
      
      // Find payments that are pending and older than 2 minutes
      const timeoutPayments = await this.paymentRepository
        .createQueryBuilder('payment')
        .where('payment.status = :status', { status: 'pending' })
        .andWhere('payment.createdAt < :twoMinutesAgo', { twoMinutesAgo })
        .getMany();

      if (timeoutPayments.length === 0) {
        this.logger.log('🧹 [CLEANUP] No timeout payments found');
        return;
      }

      this.logger.log(`🧹 [CLEANUP] Found ${timeoutPayments.length} timeout payments to cancel`);

      for (const payment of timeoutPayments) {
        try {
          // Update payment status to cancelled
          await this.paymentRepository.update(payment.id, {
            status: 'cancelled',
            updatedAt: new Date()
          });

          // Update saga status to failed if exists
          const saga = await this.sagaRepository.findOne({
            where: { paymentId: payment.id }
          });

          if (saga) {
            await this.sagaRepository.update(saga.id, {
              status: 'failed',
              errorMessage: 'Payment timeout - automatically cancelled after 5 minutes',
              updatedAt: new Date()
            });
          }

          this.logger.log(`✅ [CLEANUP] Cancelled timeout payment: ${payment.id} for student: ${payment.studentId}`);
          
          // Release Redis lock if exists
          await this.releaseLock(payment.studentId);
          
        } catch (error) {
          this.logger.error(`❌ [CLEANUP] Failed to cancel payment ${payment.id}:`, error.message);
        }
      }

      this.logger.log(`🎉 [CLEANUP] Cleanup completed. Cancelled ${timeoutPayments.length} timeout payments`);
      
    } catch (error) {
      this.logger.error('❌ [CLEANUP] Error during cleanup:', error.message);
    }
  }

  // Saga Pattern Implementation
  async processPaymentSaga(paymentData: {
    payerId: string;
    studentId: string;
    amount: string;
    userEmail: string;
  }): Promise<{ success: boolean; sagaId: string; paymentId: string; message: string }> {
    // Generate paymentId using UUID format
    const paymentId = require('crypto').randomUUID();
    
    const sagaId = `saga_${paymentId}_${Date.now()}`;
    this.logger.log(`🚀 [PAYMENT_SAGA] Starting payment saga: ${sagaId}`);
    this.logger.log(`📋 [PAYMENT_SAGA] Payment data:`, {
      paymentId,
      payerId: paymentData.payerId,
      studentId: paymentData.studentId,
      amount: paymentData.amount,
      userEmail: paymentData.userEmail
    });

    const steps = [
      { id: 'create_payment', action: 'createPayment', compensation: 'cancelPayment', status: 'pending' as const, retryCount: 0, maxRetries: 3 },
      { id: 'generate_and_send_otp', action: 'generateAndSendOtp', compensation: 'clearOtp', status: 'pending' as const, retryCount: 0, maxRetries: 3 },
      { id: 'wait_otp_verification', action: 'waitForOtpVerification', compensation: null, status: 'pending' as const, retryCount: 0, maxRetries: 0 },
      { id: 'execute_transaction', action: 'executeTransaction', compensation: 'rollbackTransaction', status: 'pending' as const, retryCount: 0, maxRetries: 3 }
    ];

    // Create saga record in database
    this.logger.log(`💾 [PAYMENT_SAGA] Creating saga record in database...`);
    const saga = this.sagaRepository.create({
      id: sagaId,
      paymentId: paymentId,
      payerId: paymentData.payerId,
      studentId: paymentData.studentId,
      amount: paymentData.amount,
      userEmail: paymentData.userEmail,
      status: 'pending',
      currentStepIndex: 0,
      steps: steps,
      completedSteps: []
    });

    await this.sagaRepository.save(saga);
    this.logger.log(`✅ [PAYMENT_SAGA] Saga record created in database: ${sagaId}`);

    const completedSteps = [];
    let currentStepIndex = 0;

    try {
      // Execute each step
      this.logger.log(`🔄 [PAYMENT_SAGA] Starting execution of ${steps.length} step(s)...`);
      for (let i = 0; i < steps.length; i++) {
        currentStepIndex = i;
        const step = steps[i];
        
        this.logger.log(`⚡ [PAYMENT_SAGA] Executing step ${i + 1}/${steps.length}: ${step.id}`);
        
        // Special handling for wait_otp_verification step
        if (step.id === 'wait_otp_verification') {
          this.logger.log(`⏳ [PAYMENT_SAGA] Pausing saga at step: wait_otp_verification. Waiting for OTP verification...`);
          
          // Mark wait step as completed (it's just a marker step)
          const completedStep = { ...step, status: 'completed', result: { status: 'waiting' }, completedAt: new Date() };
          completedSteps.push(completedStep);
          
          // Update saga in database - pause here, will continue after OTP verification
          // Only include steps that are actually completed
          this.logger.log(`📋 [PAYMENT_SAGA] Completed steps so far: ${completedSteps.length}`, completedSteps.map(s => s.id));
          
          await this.sagaRepository.update(sagaId, {
            currentStepIndex: i + 1, // Move to next step (execute_transaction) but don't execute yet
            completedSteps: [...completedSteps], // Only include steps that are actually completed
            steps: steps.map((s, index) => 
              index === i ? { ...s, status: 'completed' as const, completedAt: new Date() } : s
            ),
            status: 'pending' // Keep as pending until OTP is verified
          });
          
          this.logger.log(`✅ [PAYMENT_SAGA] Saga paused. Waiting for OTP verification to continue...`);
          return {
            success: true,
            sagaId,
            paymentId,
            message: 'Payment saga paused. Please verify OTP to continue.'
          };
        }
        
        try {
          const result = await this.executeStep(step, { ...paymentData, paymentId });
          const completedStep = { ...step, status: 'completed', result, completedAt: new Date() };
          completedSteps.push(completedStep);
          
          // Update saga in database - only update completedSteps with steps that are actually completed
          this.logger.log(`💾 [PAYMENT_SAGA] Updating saga record after step completion...`);
          this.logger.log(`📋 [PAYMENT_SAGA] Completed steps so far: ${completedSteps.length}`, completedSteps.map(s => s.id));
          
          await this.sagaRepository.update(sagaId, {
            currentStepIndex: i + 1,
            completedSteps: [...completedSteps], // Only include steps that are actually completed
            steps: steps.map((s, index) => 
              index === i ? { ...s, status: 'completed' as const, completedAt: new Date() } : s
            )
          });
          
          this.logger.log(`✅ [PAYMENT_SAGA] Step ${step.id} completed successfully`);
        } catch (error) {
          this.logger.error(`❌ [PAYMENT_SAGA] Step ${step.id} failed:`, error.message);
          
          // Update saga status to failed
          this.logger.log(`💾 [PAYMENT_SAGA] Updating saga status to failed...`);
          await this.sagaRepository.update(sagaId, {
            status: 'failed',
            errorMessage: error.message,
            steps: steps.map((s, index) => 
              index === i ? { ...s, status: 'failed' as const, error: error.message } : s
            )
          });
          
          // Start compensation
          this.logger.log(`🔄 [PAYMENT_SAGA] Starting compensation for saga: ${sagaId}`);
          await this.compensateSaga(completedSteps, { ...paymentData, paymentId });
          
          return {
            success: false,
            sagaId,
            paymentId,
            message: `Payment saga failed at step: ${step.id}. Error: ${error.message}. Compensation completed.`
          };
        }
      }

      // Update saga status to completed
      this.logger.log(`💾 [PAYMENT_SAGA] Updating saga status to completed...`);
      await this.sagaRepository.update(sagaId, {
        status: 'completed'
      });
      
      this.logger.log(`🎉 [PAYMENT_SAGA] Payment saga completed successfully: ${sagaId}`);
      return {
        success: true,
        sagaId,
        paymentId,
        message: 'Payment saga completed successfully'
      };

    } catch (error) {
      this.logger.error(`💥 [PAYMENT_SAGA] Saga execution failed:`, error.message);
      return {
        success: false,
        sagaId,
        paymentId,
        message: `Payment saga failed: ${error.message}`
      };
    }
  }

  private async executeStep(step: any, paymentData: any): Promise<any> {
    this.logger.log(`🔧 [EXECUTE_STEP] Executing action: ${step.action}`);
    switch (step.action) {
      case 'createPayment':
        this.logger.log(`💳 [EXECUTE_STEP] Creating payment with data:`, {
          paymentId: paymentData.paymentId,
          payerId: paymentData.payerId,
          studentId: paymentData.studentId,
          amount: paymentData.amount
        });
        return await this.createPayment({
          paymentId: paymentData.paymentId,
          payerId: paymentData.payerId,
          studentId: paymentData.studentId,
          amount: paymentData.amount
        });
      
      case 'generateAndSendOtp':
        this.logger.log(`🔐 [EXECUTE_STEP] Generating and sending OTP for payment: ${paymentData.paymentId}`);
        return await this.generateAndSendOtpForPayment({
          paymentId: paymentData.paymentId,
          userEmail: paymentData.userEmail,
          studentId: paymentData.studentId
        });
      
      case 'waitForOtpVerification':
        this.logger.log(`⏳ [EXECUTE_STEP] Waiting for OTP verification for payment: ${paymentData.paymentId}`);
        // This step doesn't actually execute anything, it just marks that we're waiting
        // The saga will continue when OTP is verified via verifyOtpAndCompletePayment
        return { status: 'waiting', message: 'Waiting for OTP verification' };
      
      case 'executeTransaction':
        this.logger.log(`💰 [EXECUTE_STEP] Executing transaction for payment: ${paymentData.paymentId}`);
        return await this.executeTransaction(paymentData);
      
      default:
        this.logger.error(`❌ [EXECUTE_STEP] Unknown step action: ${step.action}`);
        throw new Error(`Unknown step action: ${step.action}`);
    }
  }

  private async compensateSaga(completedSteps: any[], paymentData: any): Promise<void> {
    this.logger.log(`🔄 [COMPENSATION] Starting compensation for ${completedSteps.length} completed step(s)`);
    // Execute compensation in reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const step = completedSteps[i];
      this.logger.log(`🔧 [COMPENSATION] Compensating step ${i + 1}/${completedSteps.length}: ${step.id}`);
      
      try {
        await this.executeCompensation(step, paymentData);
        this.logger.log(`✅ [COMPENSATION] Compensation completed for step: ${step.id}`);
      } catch (error) {
        this.logger.error(`❌ [COMPENSATION] Compensation failed for step ${step.id}:`, error.message);
        // Continue with other compensations even if one fails
      }
    }
    this.logger.log(`🏁 [COMPENSATION] Compensation process completed`);
  }

  private async executeCompensation(step: any, paymentData: any): Promise<void> {
    this.logger.log(`🔧 [EXECUTE_COMPENSATION] Executing compensation: ${step.compensation}`);
    switch (step.compensation) {
      case 'cancelPayment':
        this.logger.log(`❌ [EXECUTE_COMPENSATION] Cancelling payment: ${paymentData.paymentId}`);
        // Skip saga compensation to avoid infinite loop - payment is already being cancelled
        await this.cancelPayment(paymentData.paymentId, 'Payment cancelled during saga compensation', undefined, true);
        break;
      case 'clearOtp':
        this.logger.log(`🧹 [EXECUTE_COMPENSATION] Clearing OTP for payment: ${paymentData.paymentId}`);
        // OTP will be cleared automatically when payment is cancelled
        // But we can explicitly clear it if needed
        try {
          await this.microservicesClient.clearOtp(paymentData.paymentId);
          this.logger.log(`✅ [EXECUTE_COMPENSATION] OTP cleared successfully`);
        } catch (error) {
          this.logger.warn(`⚠️ [EXECUTE_COMPENSATION] Failed to clear OTP: ${error.message}`);
          // Don't throw, just log - OTP will expire anyway
        }
        break;
      case 'rollbackTransaction':
        this.logger.log(`🔄 [EXECUTE_COMPENSATION] Rolling back transaction: ${paymentData.paymentId}`);
        await this.rollbackTransaction(paymentData.paymentId);
        break;
      default:
        this.logger.warn(`⚠️ [EXECUTE_COMPENSATION] No compensation defined for step: ${step.id}`);
    }
  }

  // Original createPayment method (now used as a step in saga)
  async createPayment(paymentData: {
    paymentId: string;
    payerId: string;
    studentId: string;
    amount: string; // client-provided but must equal full tuition
  }): Promise<Payment> {
    this.logger.log(`💳 [CREATE_PAYMENT] Starting payment creation process`);
    this.logger.log(`📋 [CREATE_PAYMENT] Payment data:`, {
      paymentId: paymentData.paymentId,
      payerId: paymentData.payerId,
      studentId: paymentData.studentId,
      amount: paymentData.amount
    });

    // Validate input data
    this.logger.log(`🔍 [CREATE_PAYMENT] Validating input data...`);
    if (!paymentData.payerId) {
      this.logger.error('❌ [CREATE_PAYMENT] Payer ID is missing');
      throw new BadRequestException('Payer ID is required');
    }
    if (!paymentData.studentId) {
      this.logger.error('❌ [CREATE_PAYMENT] Student ID is missing');
      throw new BadRequestException('Student ID is required');
    }
    if (!paymentData.amount) {
      this.logger.error('❌ [CREATE_PAYMENT] Amount is missing');
      throw new BadRequestException('Amount is required');
    }
    this.logger.log(`✅ [CREATE_PAYMENT] Input validation passed`);

    // Check if there's already a pending payment for this student
    this.logger.log(`🔍 [CREATE_PAYMENT] Checking for existing pending payments for student ${paymentData.studentId}...`);
    const existingPayment = await this.paymentRepository.findOne({
      where: { 
        studentId: paymentData.studentId,
        status: 'pending'
      }
    });
    
    if (existingPayment) {
      this.logger.error(`❌ [CREATE_PAYMENT] Payment already exists for student ${paymentData.studentId}:`, existingPayment.id);
      throw new BadRequestException(`Đã có thanh toán đang chờ xử lý cho studentId ${paymentData.studentId}. Vui lòng đợi thanh toán hiện tại hoàn thành.`);
    }

    // Check if there's already a completed payment for this student (tuition already paid)
    // But only if the current tuition amount is 0 (meaning it's already paid)
    const completedPayment = await this.paymentRepository.findOne({
      where: { 
        studentId: paymentData.studentId,
        status: 'completed'
      }
    });
    
    if (completedPayment) {
      this.logger.log(`🔍 [CREATE_PAYMENT] Found completed payment for student ${paymentData.studentId}, checking current tuition amount...`);
      // We'll check the tuition amount later in the validation process
      // If tuition amount > 0, it means there's new tuition to pay
    }

    // Acquire distributed lock for this student to prevent concurrent payments
    this.logger.log(`🔒 [CREATE_PAYMENT] Acquiring lock for student ${paymentData.studentId}...`);
    const lockAcquired = await this.waitForLock(paymentData.studentId, 15000); // Wait up to 15 seconds
    
    if (!lockAcquired) {
      this.logger.error(`❌ [CREATE_PAYMENT] Failed to acquire lock for student ${paymentData.studentId} - another payment is in progress`);
      throw new BadRequestException('Another payment is currently being processed for this student. Please try again in a moment.');
    }
    
    this.logger.log(`✅ [CREATE_PAYMENT] Lock acquired for student ${paymentData.studentId}`);

    try {
      this.logger.log('👤 [CREATE_PAYMENT] Starting to fetch user data...');
      // Fetch authoritative data
      const userResp = await this.getUserData(paymentData.payerId);
      this.logger.log('📥 [CREATE_PAYMENT] User data response:', JSON.stringify(userResp, null, 2));
      
      const user = (userResp && typeof userResp === 'object' && 'success' in userResp) ? userResp.data : userResp;
      if (!user) {
        this.logger.error('❌ [CREATE_PAYMENT] User not found in response:', userResp);
        throw new BadRequestException('Payer not found');
      }
      this.logger.log('✅ [CREATE_PAYMENT] User data retrieved successfully:', { id: user.id, email: user.email, balance: user.availableBalance });

      this.logger.log('🎓 [CREATE_PAYMENT] Starting to fetch student data...');
      const studentResp = await this.getStudentData(paymentData.studentId);
      this.logger.log('📥 [CREATE_PAYMENT] Student data response:', JSON.stringify(studentResp, null, 2));
      
      const student = (studentResp && typeof studentResp === 'object' && 'success' in studentResp) ? studentResp.data : studentResp;
      if (!student) {
        this.logger.error('❌ [CREATE_PAYMENT] Student not found in response:', studentResp);
        throw new BadRequestException('Student not found');
      }
      this.logger.log('✅ [CREATE_PAYMENT] Student data retrieved successfully:', { id: student.studentId, name: student.studentName, amount: student.amount });

      this.logger.log('🔍 [CREATE_PAYMENT] Starting business logic validation...');
      const payerBalance = parseFloat(user.availableBalance);
      const tuition = parseFloat(student.amount);
      const requested = parseFloat(paymentData.amount);

      this.logger.log('💰 [CREATE_PAYMENT] Amounts parsed:', { payerBalance, tuition, requested });

      if (Number.isNaN(requested) || Number.isNaN(tuition)) {
        this.logger.error('❌ [CREATE_PAYMENT] Invalid amount - NaN detected:', { requested, tuition });
        throw new BadRequestException('Invalid amount');
      }

      // Check if tuition amount is 0 (already paid)
      if (tuition <= 0) {
        this.logger.error('❌ [CREATE_PAYMENT] No tuition due:', { studentId: paymentData.studentId, tuition });
        if (completedPayment) {
          throw new BadRequestException(`Học phí cho studentId ${paymentData.studentId} đã được thanh toán. Không có học phí mới để thanh toán.`);
        } else {
          throw new BadRequestException(`Hiện tại chưa có học phí cho studentId ${paymentData.studentId} này`);
        }
      }

      // If there's a completed payment but tuition > 0, it means there's new tuition
      if (completedPayment && tuition > 0) {
        this.logger.log(`✅ [CREATE_PAYMENT] Found new tuition for student ${paymentData.studentId} after previous payment. Allowing new payment.`);
      }

      // Full tuition only
      if (Math.abs(requested - tuition) > 0.009) {
        this.logger.error('❌ [CREATE_PAYMENT] Partial payment not allowed:', { requested, tuition, difference: Math.abs(requested - tuition) });
        throw new BadRequestException('Must pay full tuition amount');
      }

      // Balance must be enough
      if (payerBalance < tuition) {
        this.logger.error('❌ [CREATE_PAYMENT] Insufficient balance:', { payerBalance, tuition, shortfall: tuition - payerBalance });
        throw new BadRequestException('Insufficient balance');
      }
      
      this.logger.log('✅ [CREATE_PAYMENT] All validations passed');

      this.logger.log('🏗️ [CREATE_PAYMENT] Creating payment entity...');
      const payment = this.paymentRepository.create({
        id: paymentData.paymentId, // Use the paymentId from Saga as the primary key
        payerBalance: payerBalance.toFixed(2),
        tuitionAmount: tuition.toFixed(2),
        paymentTerms: 'Agree to pay full tuition amount',
        payerId: paymentData.payerId,
        studentId: paymentData.studentId,
        status: 'pending',
      });

      this.logger.log('💾 [CREATE_PAYMENT] Saving payment to database...');
      const savedPayment = await this.paymentRepository.save(payment);
      this.logger.log('✅ [CREATE_PAYMENT] Payment saved successfully:', { id: savedPayment.id, status: savedPayment.status });
      
      // Note: OTP generation and email sending will be handled in the next saga step
      this.logger.log('🎉 [CREATE_PAYMENT] Payment creation completed successfully');
      return savedPayment;
    } catch (error) {
      this.logger.error(`💥 [CREATE_PAYMENT] Failed to create payment: ${error.message}`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Payment creation failed: ${error.message}`);
    } finally {
      // Always release the lock, regardless of success or failure
      this.logger.log(`🔓 [CREATE_PAYMENT] Releasing lock for student ${paymentData.studentId}...`);
      await this.releaseLock(paymentData.studentId);
    }
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async updateStatus(id: string, status: 'pending' | 'completed' | 'failed' | 'cancelled'): Promise<Payment> {
    const payment = await this.findById(id);
    payment.status = status;
    const updatedPayment = await this.paymentRepository.save(payment);
    
    // Publish PaymentStatusChanged event
    await this.publishPaymentStatusChangedEvent(updatedPayment);
    
    return updatedPayment;
  }


  async getPaymentsByPayer(payerId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { payerId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPaymentsByStudent(studentId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }

  // RPC method to get user data using NestJS Microservices
  private async getUserData(userId: string): Promise<any> {
    this.logger.log(`[RPC] Getting user data for userId: ${userId}`);
    try {
      const response = await this.callService('users', 'get', { userId });
      this.logger.log(`[RPC] getUserData completed successfully:`, response);
      return response;
    } catch (error) {
      this.logger.error('Failed to get user data via NestJS Microservices:', error);
      throw error;
    }
  }

  // RPC method to get student data
  private async getStudentData(studentId: string): Promise<any> {
    let conn = null;
    let ch = null;
    
    this.logger.log(`[RPC] Starting getStudentData for studentId: ${studentId}`);
    
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
      this.logger.log(`[RPC] Connecting to RabbitMQ: ${url}`);
      conn = await connect(url);
      ch = await conn.createChannel();

      const queue = 'students.lookup';
      const correlationId = Math.random().toString();
      this.logger.log(`[RPC] Using queue: ${queue}, correlationId: ${correlationId}`);

      // Create a temporary exclusive queue for the response
      const { queue: replyQueue } = await ch.assertQueue('', { exclusive: true });
      this.logger.log(`[RPC] Created reply queue: ${replyQueue}`);

      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.logger.error(`[RPC] Timeout waiting for response from ${queue}`);
          reject(new Error('RPC timeout for students.lookup'));
        }, 10000);

        ch.consume(replyQueue, (msg) => {
          if (msg && msg.properties.correlationId === correlationId) {
            clearTimeout(timeout);
            try {
              const result = JSON.parse(msg.content.toString());
              this.logger.log(`[RPC] Received response from ${queue}:`, result);
              ch.ack(msg);
              resolve(result);
            } catch (parseError) {
              this.logger.error('Failed to parse student data response:', parseError);
              reject(new Error('Invalid response format'));
            }
          }
        });

        const requestData = { studentId };
        this.logger.log(`[RPC] Sending request to ${queue}:`, requestData);
        ch.sendToQueue(queue, Buffer.from(JSON.stringify(requestData)), {
          correlationId,
          replyTo: replyQueue,
        });
      });

      this.logger.log(`[RPC] getStudentData completed successfully`);
      return response;
    } catch (error) {
      this.logger.error('Failed to get student data via RPC:', error);
      throw error;
    } finally {
      try {
        if (ch) await ch.close();
        if (conn) await conn.close();
        this.logger.log(`[RPC] RabbitMQ connections closed`);
      } catch (closeError) {
        this.logger.warn(`Failed to close RabbitMQ connections: ${closeError.message}`);
      }
    }
  }

  // RPC call method
  private async callService(service: string, action: string, data: any): Promise<any> {
    let conn = null;
    let ch = null;
    
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
      conn = await connect(url);
      ch = await conn.createChannel();

      const queue = `${service}.${action}`;
      const { queue: replyTo } = await ch.assertQueue('', { exclusive: true });
      
      const correlationId = Math.random().toString();
      const timeout = 15000; // 15 seconds timeout
      
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          // Close connections on timeout
          try {
            if (ch) ch.close();
            if (conn) conn.close();
          } catch (closeError) {
            // Ignore close errors on timeout
          }
          reject(new Error(`Service call timeout for ${service}.${action}`));
        }, timeout);

        ch.consume(replyTo, (msg) => {
          if (msg.properties.correlationId === correlationId) {
            clearTimeout(timer);
            try {
              const response = JSON.parse(msg.content.toString());
              // Close connections after receiving response
              try {
                if (ch) ch.close();
                if (conn) conn.close();
              } catch (closeError) {
                // Ignore close errors
              }
              resolve(response);
            } catch (error) {
              // Close connections on parse error
              try {
                if (ch) ch.close();
                if (conn) conn.close();
              } catch (closeError) {
                // Ignore close errors
              }
              reject(new Error(`Failed to parse response: ${error.message}`));
            }
          }
        }, { noAck: true });

        ch.sendToQueue(queue, Buffer.from(JSON.stringify(data)), {
          correlationId,
          replyTo,
        });
      });
    } catch (error) {
      // Close connections on connection error
      try {
        if (ch) await ch.close();
        if (conn) await conn.close();
      } catch (closeError) {
        this.logger.warn(`Failed to close RabbitMQ connections: ${closeError.message}`);
      }
      throw new Error(`Service call failed: ${service}.${action} - ${error.message}`);
    }
  }

  // OTP generation method - call OTP Service
  private async generateOtpForPayment(paymentId: string, userEmail: string, studentId: string): Promise<string> {
    this.logger.log(`🔐 [GENERATE_OTP] Calling OTP Service to generate OTP for payment: ${paymentId}`);
    
    try {
      // Call OTP Service to generate OTP
      const result = await this.microservicesClient.generateOtp(paymentId, userEmail, studentId);
      this.logger.log(`✅ [GENERATE_OTP] OTP Service response:`, result);
      
      if (result && result.success) {
        this.logger.log(`✅ [GENERATE_OTP] OTP generated successfully by OTP Service`);
        return result.data.otp || result.otp; // Return the OTP from service
      } else {
        throw new Error(`OTP Service failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      this.logger.error(`💥 [GENERATE_OTP] Failed to generate OTP via OTP Service: ${error.message}`);
      throw error;
    }
  }

  // Generate and send OTP for payment (saga step)
  private async generateAndSendOtpForPayment(paymentData: {
    paymentId: string;
    userEmail: string;
    studentId: string;
  }): Promise<any> {
    this.logger.log(`🔐 [GENERATE_AND_SEND_OTP] Generating and sending OTP for payment: ${paymentData.paymentId}`);
    
    try {
      // Generate OTP - OTP Service will automatically publish event to send email via Notification Service
      const otp = await this.generateOtpForPayment(paymentData.paymentId, paymentData.userEmail, paymentData.studentId);
      this.logger.log(`✅ [GENERATE_AND_SEND_OTP] OTP generated and email sent automatically by OTP Service`);
      
      return {
        paymentId: paymentData.paymentId,
        otpGenerated: true,
        emailSent: true,
        message: 'OTP generated and email sent successfully'
      };
    } catch (error) {
      this.logger.error(`💥 [GENERATE_AND_SEND_OTP] Failed to generate and send OTP: ${error.message}`);
      throw error;
    }
  }

  private async executeTransaction(paymentData: any): Promise<any> {
    this.logger.log(`Executing transaction for payment: ${paymentData.paymentId}`);
    
    // Update payment status to completed
    const payment = await this.paymentRepository.findOne({ where: { id: paymentData.paymentId } });
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    // Deduct amount from user balance
    this.logger.log(`Deducting ${paymentData.amount} from user ${paymentData.payerId}`);
    const deductResp = await this.callService('users', 'deduct_balance', {
      userId: paymentData.payerId,
      amount: paymentData.amount,
      transactionId: paymentData.paymentId
    });
    
    this.logger.log(`Deduct balance response:`, deductResp);
    
    if (!deductResp || !deductResp.success) {
      throw new Error(`Failed to deduct balance: ${deductResp?.error || 'Unknown error'}`);
    }

    // Update tuition amount (set to 0 after payment)
    this.logger.log(`Updating tuition amount for student ${payment.studentId}`);
    try {
      const tuitionUpdateResp = await this.callService('tuition', 'update_amount', {
        studentId: payment.studentId,
        amount: '0.00'
      });
      this.logger.log(`Tuition update response:`, tuitionUpdateResp);
      
      if (!tuitionUpdateResp || !tuitionUpdateResp.success) {
        this.logger.warn(`Failed to update tuition amount: ${tuitionUpdateResp?.error || 'Unknown error'}`);
        // Don't throw error - payment is still successful
      }
    } catch (error) {
      this.logger.warn(`Failed to update tuition amount:`, error.message);
      // Don't throw error - payment is still successful
    }
    
    if (!deductResp.newBalance) {
      throw new Error(`Invalid response from users service: missing newBalance`);
    }
    
    this.logger.log(`Balance deducted successfully. New balance: ${deductResp.newBalance}`);
    
    payment.status = 'completed';
    await this.paymentRepository.save(payment);
    
    // Publish transaction completed event
    await this.publishPaymentStatusChangedEvent(payment);
    
    // Publish payment completed event for email notification
    this.logger.log(`📧 [DEBUG] Payment data userEmail: ${paymentData.userEmail}`);
    this.logger.log(`📧 [DEBUG] Payment data keys: ${Object.keys(paymentData)}`);
    await this.publishPaymentCompletedEvent(payment, paymentData.userEmail, deductResp.newBalance);
    
    return { 
      success: true, 
      paymentId: paymentData.paymentId,
      newBalance: deductResp.newBalance
    };
  }

  // Compensation methods
  // Note: OTP and notification compensation are handled automatically via events

  async rollbackTransaction(paymentId: string): Promise<void> {
    this.logger.log(`Rolling back transaction for payment: ${paymentId}`);
    const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
    if (payment) {
      // Refund amount to user balance
      this.logger.log(`Refunding ${payment.tuitionAmount} to user ${payment.payerId}`);
      try {
        const refundResp = await this.callService('users', 'add_balance', {
          userId: payment.payerId,
          amount: payment.tuitionAmount,
          transactionId: paymentId
        });
        
        if (refundResp && refundResp.success) {
          this.logger.log(`Balance refunded successfully. New balance: ${refundResp.data.newBalance}`);
        } else {
          this.logger.warn(`Failed to refund balance: ${refundResp?.error || 'Unknown error'}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to refund balance: ${error.message}`);
      }
      
      payment.status = 'failed';
      await this.paymentRepository.save(payment);
      await this.publishPaymentStatusChangedEvent(payment);
    }
  }

  // Saga status methods
  async getSagaStatus(sagaId: string): Promise<Saga | null> {
    return this.sagaRepository.findOne({ where: { id: sagaId } });
  }

  async getAllSagas(): Promise<Saga[]> {
    return this.sagaRepository.find({ order: { createdAt: 'DESC' } });
  }


  private async publishPaymentCreatedEvent(payment: Payment, userEmail: string): Promise<void> {
    let conn = null;
    let ch = null;
    
    this.logger.log(`[EVENT] Starting to publish PaymentCreated event for payment ${payment.id}`);
    
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
      this.logger.log(`[EVENT] Connecting to RabbitMQ: ${url}`);
      conn = await connect(url);
      ch = await conn.createChannel();

      this.logger.log(`[EVENT] Asserting exchange 'payments'`);
      await ch.assertExchange('payments', 'topic', { durable: true });

      const event = {
        type: 'PaymentCreated',
        data: {
          paymentId: payment.id,
          payerId: payment.payerId,
          studentId: payment.studentId,
          amount: payment.tuitionAmount,
          userEmail,
          createdAt: payment.createdAt,
        },
      };

      this.logger.log(`[EVENT] Publishing event:`, event);
      ch.publish('payments', 'payment.created', Buffer.from(JSON.stringify(event)));
      this.logger.log(`[EVENT] PaymentCreated event published successfully for payment ${payment.id}`);
    } catch (error) {
      this.logger.error(`[EVENT] Failed to publish PaymentCreated event:`, error);
      // Don't throw error for event publishing failure
    } finally {
      try {
        if (ch) await ch.close();
        if (conn) await conn.close();
        this.logger.log(`[EVENT] RabbitMQ connections closed`);
      } catch (closeError) {
        this.logger.warn(`[EVENT] Failed to close RabbitMQ connections: ${closeError.message}`);
      }
    }
  }

  private async publishPaymentStatusChangedEvent(payment: Payment): Promise<void> {
    let conn = null;
    let ch = null;
    
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
      conn = await connect(url);
      ch = await conn.createChannel();

      await ch.assertExchange('payments', 'topic', { durable: true });

      const event = {
        type: 'PaymentStatusChanged',
        data: {
          paymentId: payment.id,
          payerId: payment.payerId,
          studentId: payment.studentId,
          status: payment.status,
          amount: payment.tuitionAmount,
          updatedAt: payment.updatedAt,
        },
      };

      ch.publish('payments', 'payment.status.changed', Buffer.from(JSON.stringify(event)));
      this.logger.log(`PaymentStatusChanged event published for payment ${payment.id}`);
    } catch (error) {
      this.logger.error(`Failed to publish PaymentStatusChanged event:`, error);
      // Don't throw error for event publishing failure
    } finally {
      try {
        if (ch) await ch.close();
        if (conn) await conn.close();
      } catch (closeError) {
        this.logger.warn(`Failed to close RabbitMQ connections: ${closeError.message}`);
      }
    }
  }

  

  // OTP Verification and Payment Completion
  async verifyOtpAndCompletePayment(paymentId: string, otp: string): Promise<any> {
    this.logger.log(`Verifying OTP for payment: ${paymentId}`);
    
    try {
      // Find the payment
      const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      if (payment.status !== 'pending') {
        throw new HttpException('Payment is not in pending status', HttpStatus.BAD_REQUEST);
      }

      // Verify OTP with OTP service
      const otpResp = await this.microservicesClient.verifyOtp(paymentId, otp);

      this.logger.log(`OTP verification response:`, otpResp);

      if (!otpResp || !otpResp.success) {
        throw new HttpException(`Invalid OTP: ${otpResp?.error || 'OTP verification failed'}`, HttpStatus.BAD_REQUEST);
      }

      // Check if OTP is actually valid
      if (!otpResp.data || !otpResp.data.isValid) {
        // OTP is invalid - let OTP Service handle retry logic
        // Don't throw error here, let the catch block handle it
        throw new Error('Invalid OTP');
      }

      this.logger.log(`OTP verified successfully for payment: ${paymentId}`);

      // Find the saga for this payment
      const saga = await this.sagaRepository.findOne({
        where: { paymentId: paymentId }
      });

      if (saga) {
        this.logger.log(`🔄 [VERIFY_OTP] Found saga ${saga.id}, continuing saga execution...`);
        
        // Get user email from Users Service
        this.logger.log(`📧 [VERIFY_OTP] Getting user email for payerId: ${payment.payerId}`);
        const userInfo = await this.callService('users', 'get', { userId: payment.payerId });
        this.logger.log(`📧 [VERIFY_OTP] User info:`, userInfo);
        
        if (!userInfo || !userInfo.success || !userInfo.data || !userInfo.data.email) {
          throw new Error('User email not found');
        }

        // Continue saga from execute_transaction step
        const executeStepIndex = saga.steps.findIndex(s => s.id === 'execute_transaction');
        if (executeStepIndex === -1) {
          throw new Error('execute_transaction step not found in saga');
        }

        this.logger.log(`💰 [VERIFY_OTP] Continuing saga with execute_transaction step...`);
        
        try {
          // Execute the transaction step
          const transactionResult = await this.executeTransaction({
            paymentId: paymentId,
            payerId: payment.payerId,
            amount: payment.tuitionAmount,
            userEmail: userInfo.data.email
          });

          this.logger.log(`Transaction executed successfully:`, transactionResult);

          // Update saga - mark execute_transaction as completed
          // Only include steps that are actually completed
          const updatedCompletedSteps = [...(saga.completedSteps || [])];
          const executeStep = saga.steps[executeStepIndex];
          updatedCompletedSteps.push({
            ...executeStep,
            status: 'completed',
            result: transactionResult,
            completedAt: new Date()
          });

          this.logger.log(`📋 [VERIFY_OTP] Completed steps after transaction: ${updatedCompletedSteps.length}`, updatedCompletedSteps.map(s => s.id));

          await this.sagaRepository.update(saga.id, {
            status: 'completed',
            currentStepIndex: executeStepIndex + 1,
            completedSteps: updatedCompletedSteps, // Only include steps that are actually completed
            steps: saga.steps.map((s, index) => 
              index === executeStepIndex ? { ...s, status: 'completed' as const, completedAt: new Date() } : s
            )
          });

          this.logger.log(`✅ [VERIFY_OTP] Saga completed successfully after OTP verification`);

          return {
            paymentId: paymentId,
            status: 'completed',
            sagaId: saga.id,
            message: 'Payment completed successfully'
          };
        } catch (error) {
          this.logger.error(`❌ [VERIFY_OTP] Failed to execute transaction step: ${error.message}`);
          
          // Update saga status to failed
          await this.sagaRepository.update(saga.id, {
            status: 'failed',
            errorMessage: error.message,
            steps: saga.steps.map((s, index) => 
              index === executeStepIndex ? { ...s, status: 'failed' as const, error: error.message } : s
            )
          });

          // Start compensation
          this.logger.log(`🔄 [VERIFY_OTP] Starting compensation for saga: ${saga.id}`);
          await this.compensateSaga(saga.completedSteps || [], {
            paymentId: paymentId,
            payerId: payment.payerId,
            studentId: payment.studentId,
            amount: payment.tuitionAmount,
            userEmail: userInfo.data.email
          });

          throw error;
        }
      } else {
        // No saga found, execute transaction directly (backward compatibility)
        this.logger.log(`⚠️ [VERIFY_OTP] No saga found for payment ${paymentId}, executing transaction directly...`);
        
        // Get user email from Users Service
        this.logger.log(`📧 [VERIFY_OTP] Getting user email for payerId: ${payment.payerId}`);
        const userInfo = await this.callService('users', 'get', { userId: payment.payerId });
        this.logger.log(`📧 [VERIFY_OTP] User info:`, userInfo);
        
        if (!userInfo || !userInfo.success || !userInfo.data || !userInfo.data.email) {
          throw new Error('User email not found');
        }

        // Execute the actual transaction (deduct balance)
        const transactionResult = await this.executeTransaction({
          paymentId: paymentId,
          payerId: payment.payerId,
          amount: payment.tuitionAmount,
          userEmail: userInfo.data.email
        });

        this.logger.log(`Transaction executed successfully:`, transactionResult);

        return {
          paymentId: paymentId,
          status: 'completed',
          message: 'Payment completed successfully'
        };
      }

    } catch (error) {
      this.logger.error(`OTP verification failed for payment ${paymentId}:`, error);
      
      // Check error types based on error codes from OTP Service
      const errorMessage = error.message || '';
      const isOtpExpired = errorMessage.includes('OTP_EXPIRED:');
      const isMaxAttempts = errorMessage.includes('OTP_MAX_ATTEMPTS:');
      
      // Check if it's just invalid OTP (allow retry)
      const isInvalidOtp = !errorMessage.includes('OTP_EXPIRED:') && 
                          !errorMessage.includes('OTP_MAX_ATTEMPTS:') &&
                          errorMessage.includes('Invalid OTP');
      
      if (isOtpExpired) {
        this.logger.log(`🕐 [OTP_EXPIRED] OTP expired for payment ${paymentId}, cancelling payment...`);
        
        // Get payment info first to get studentId for lock release
        const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
        if (!payment) {
          this.logger.error(`❌ [OTP_EXPIRED] Payment ${paymentId} not found for cancellation`);
          throw new HttpException('Payment not found for cancellation', HttpStatus.NOT_FOUND);
        }
        
        try {
          // Cancel the payment
          await this.paymentRepository.update(paymentId, {
            status: 'cancelled',
            updatedAt: new Date()
          });
          
          // Update saga status to failed if exists
          const saga = await this.sagaRepository.findOne({
            where: { paymentId: paymentId }
          });
          
          if (saga) {
            await this.sagaRepository.update(saga.id, {
              status: 'failed',
              errorMessage: 'Payment cancelled due to OTP expiry',
              updatedAt: new Date()
            });
          }
          
          // Release Redis lock (with error handling)
          try {
            await this.releaseLock(payment.studentId);
          } catch (lockError) {
            this.logger.warn(`⚠️ [OTP_EXPIRED] Failed to release lock for student ${payment.studentId}:`, lockError.message);
            // Don't throw error for lock release failure
          }
          
          this.logger.log(`✅ [OTP_EXPIRED] Payment ${paymentId} cancelled due to OTP expiry`);
          
        } catch (cancelError) {
          this.logger.error(`❌ [OTP_EXPIRED] Failed to cancel payment ${paymentId}:`, cancelError.message);
          throw new HttpException('OTP đã hết hạn và không thể hủy thanh toán.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
        
        // Throw the OTP expiry error after successful cancellation (outside try-catch)
        throw new HttpException('OTP đã hết hạn. Thanh toán đã được hủy tự động.', HttpStatus.BAD_REQUEST);
      }
      
      // Handle max attempts exceeded - cancel payment automatically
      if (isMaxAttempts) {
        this.logger.log(`🚫 [MAX_ATTEMPTS] Maximum OTP attempts exceeded for payment ${paymentId}, cancelling payment...`);
        
        // Get payment info first to get studentId for lock release
        const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
        if (!payment) {
          this.logger.error(`❌ [MAX_ATTEMPTS] Payment ${paymentId} not found for cancellation`);
          throw new HttpException('Payment not found for cancellation', HttpStatus.NOT_FOUND);
        }
        
        try {
          // Cancel the payment
          await this.paymentRepository.update(paymentId, {
            status: 'cancelled',
            updatedAt: new Date()
          });
          
          // Update saga status to failed if exists
          const saga = await this.sagaRepository.findOne({
            where: { paymentId: paymentId }
          });
          
          if (saga) {
            await this.sagaRepository.update(saga.id, {
              status: 'failed',
              errorMessage: 'Payment cancelled due to maximum OTP attempts exceeded',
              updatedAt: new Date()
            });
          }
          
          // Release Redis lock (with error handling)
          try {
            await this.releaseLock(payment.studentId);
          } catch (lockError) {
            this.logger.warn(`⚠️ [MAX_ATTEMPTS] Failed to release lock for student ${payment.studentId}:`, lockError.message);
            // Don't throw error for lock release failure
          }
          
          // Publish payment cancelled event for email notification
          try {
            await this.publishPaymentCancelledEvent(payment, 'Payment cancelled due to maximum OTP attempts exceeded');
          } catch (emailError) {
            this.logger.warn(`⚠️ [MAX_ATTEMPTS] Failed to send cancellation email:`, emailError.message);
            // Don't throw error for email failure
          }
          
          this.logger.log(`✅ [MAX_ATTEMPTS] Payment ${paymentId} cancelled due to maximum OTP attempts exceeded`);
          
        } catch (cancelError) {
          this.logger.error(`❌ [MAX_ATTEMPTS] Failed to cancel payment ${paymentId}:`, cancelError.message);
          throw new HttpException('Đã nhập sai OTP quá 5 lần và không thể hủy thanh toán.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
        
        // Throw the max attempts error after successful cancellation (outside try-catch)
        throw new HttpException('Đã nhập sai OTP quá 5 lần. Thanh toán đã được hủy tự động.', HttpStatus.BAD_REQUEST);
      }
      
      // Handle invalid OTP (allow retry)
      if (isInvalidOtp) {
        this.logger.log(`❌ [INVALID_OTP] Invalid OTP for payment ${paymentId}, allowing retry...`);
        throw new HttpException('Invalid OTP. Please try again.', HttpStatus.BAD_REQUEST);
      }
      
      throw error;
    }
  }


  // Helper methods for event handling
  async getSagaByPaymentId(paymentId: string): Promise<Saga | null> {
    return await this.sagaRepository.findOne({ where: { paymentId } });
  }

  async updateSagaStatus(sagaId: string, status: 'pending' | 'completed' | 'failed' | 'compensating', errorMessage?: string): Promise<void> {
    await this.sagaRepository.update(sagaId, {
      status,
      errorMessage,
      updatedAt: new Date()
    });
  }

  async releaseLockPublic(studentId: string): Promise<void> {
    await this.releaseLock(studentId);
  }

  // Publish payment cancelled event for email notification
  private async publishPaymentCancelledEvent(payment: Payment, reason: string): Promise<void> {
    this.logger.log(`[EVENT] Publishing PaymentCancelled event for payment ${payment.id}`);
    
    try {
      // Get user email from Users Service
      const userInfo = await this.callService('users', 'get', { userId: payment.payerId });
      if (!userInfo || !userInfo.success || !userInfo.data || !userInfo.data.email) {
        this.logger.warn(`[EVENT] User email not found for payment ${payment.id}, skipping email notification`);
        return;
      }

      // Use microservices client to publish event
      await this.microservicesClient.publishPaymentCancelled(
        payment.id,
        userInfo.data.email,
        payment.studentId,
        parseFloat(payment.tuitionAmount)
      );
      
      this.logger.log(`[EVENT] PaymentCancelled event published successfully for payment ${payment.id}`);
      
    } catch (error) {
      this.logger.error(`[EVENT] Failed to publish PaymentCancelled event:`, error);
      // Don't throw error for event publishing failure
    }
  }

  // Get OTP Information
  async getOtpInfo(paymentId: string): Promise<any> {
    this.logger.log(`Getting OTP info for payment: ${paymentId}`);
    
    try {
      // Find the payment
      const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      // Call OTP service to get OTP info
      const otpResp = await this.microservicesClient.getOtpInfo(paymentId);

      this.logger.log(`OTP info response:`, otpResp);

      if (!otpResp || !otpResp.success) {
        throw new HttpException(`Failed to get OTP info: ${otpResp?.error || 'OTP not found'}`, HttpStatus.NOT_FOUND);
      }

      return otpResp.data;

    } catch (error) {
      this.logger.error(`Failed to get OTP info for payment ${paymentId}:`, error);
      throw error;
    }
  }


  // Resend OTP for Payment (Event-driven approach)
  async resendOtpForPayment(paymentId: string, userEmail: string): Promise<any> {
    this.logger.log(`🔄 [RESEND_OTP] Resending OTP for payment: ${paymentId}`);
    
    try {
      // Find the payment
      const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      if (payment.status !== 'pending') {
        throw new HttpException('Payment is not in pending status', HttpStatus.BAD_REQUEST);
      }

      // Use userEmail from JWT token (passed as parameter)
      
      // Publish resend OTP event
      this.logger.log(`📡 [RESEND_OTP] Publishing OtpResendRequested event...`);
      await this.publishOtpResendEvent(paymentId, userEmail, payment.studentId);

      this.logger.log(`✅ [RESEND_OTP] OtpResendRequested event published for payment: ${paymentId}`);

      return {
        paymentId: paymentId,
        expiresIn: 120, // 2 minutes
        message: 'OTP resend event published - new OTP will be generated and sent via email'
      };

    } catch (error) {
      this.logger.error(`💥 [RESEND_OTP] OTP resend failed for payment ${paymentId}:`, error);
      throw error;
    }
  }


  // Publish OTP resend event
  private async publishOtpResendEvent(paymentId: string, userEmail: string, studentId: string): Promise<void> {
    this.logger.log(`📡 [EVENT] Publishing OtpResendRequested event for payment ${paymentId}`);
    
    try {
      const event = {
        type: 'OtpResendRequested',
        data: {
          email: userEmail,
          studentId,
          transactionId: paymentId, // Use paymentId as transactionId
        },
      };

      // Use microservices client to publish event
      await this.microservicesClient.publishEvent('otp.resend_requested', event);
      
      this.logger.log(`✅ [EVENT] OtpResendRequested event published successfully for payment ${paymentId}`);
    } catch (error) {
      this.logger.error(`💥 [EVENT] Failed to publish OtpResendRequested event:`, error);
      throw error;
    }
  }

  // Publish payment completed event for email notification
  private async publishPaymentCompletedEvent(payment: any, userEmail: string, newBalance: number): Promise<void> {
    this.logger.log(`📡 [EVENT] Publishing PaymentCompleted event for payment ${payment.id}`);
    
    try {
      const event = {
        type: 'PaymentCompleted',
        data: {
          userEmail: userEmail,
          paymentId: payment.id,
          studentId: payment.studentId,
          amount: payment.tuitionAmount,
          newBalance: newBalance,
          completedAt: new Date().toISOString(),
        },
      };

      // Use microservices client to publish event to notification service
      await this.microservicesClient.publishEvent('payment.completed', event);
      
      this.logger.log(`✅ [EVENT] PaymentCompleted event published successfully for payment ${payment.id}`);
    } catch (error) {
      this.logger.error(`💥 [EVENT] Failed to publish PaymentCompleted event:`, error);
      throw error;
    }
  }

  // Additional methods for event handlers
  async completePayment(paymentId: string): Promise<void> {
    this.logger.log(`Completing payment: ${paymentId}`);
    
    // Find the saga for this payment
    const saga = await this.sagaRepository.findOne({ where: { paymentId: paymentId } });
    if (!saga) {
      throw new HttpException('Saga not found for payment', HttpStatus.NOT_FOUND);
    }

    // Update saga status to completed
    saga.status = 'completed';
    await this.sagaRepository.save(saga);

    // Update payment status
    const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
    if (payment) {
      payment.status = 'completed';
      await this.paymentRepository.save(payment);
    }
    
    this.logger.log(`Payment ${paymentId} and saga completed successfully`);
  }

  async failPayment(paymentId: string, reason: string): Promise<void> {
    this.logger.log(`Failing payment: ${paymentId}, reason: ${reason}`);
    
    // Find the saga for this payment
    const saga = await this.sagaRepository.findOne({ where: { paymentId: paymentId } });
    if (saga) {
      saga.status = 'failed';
      saga.errorMessage = reason;
      await this.sagaRepository.save(saga);
    }

    // Update payment status
    const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
    if (payment) {
      payment.status = 'failed';
      await this.paymentRepository.save(payment);
    }
    
    this.logger.log(`Payment ${paymentId} and saga failed: ${reason}`);
  }

  async getPaymentById(paymentId: string): Promise<Payment | null> {
    return await this.paymentRepository.findOne({ where: { id: paymentId } });
  }

  async getPendingPaymentsByPayer(payerId: string): Promise<Payment[]> {
    return await this.paymentRepository.find({ 
      where: { 
        payerId: payerId, 
        status: 'pending' 
      } 
    });
  }

  async getPendingPaymentsByStudent(studentId: string): Promise<Payment[]> {
    return await this.paymentRepository.find({ 
      where: { 
        studentId: studentId, 
        status: 'pending' 
      } 
    });
  }

  async cancelPayment(paymentId: string, reason?: string, payerId?: string, skipSagaCompensation: boolean = false): Promise<void> {
    this.logger.log(`🚫 [CANCEL_PAYMENT] Cancelling payment: ${paymentId}, reason: ${reason || 'User cancelled'}, skipSagaCompensation: ${skipSagaCompensation}`);
    
    // Find the payment first
    const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    // If payment is already cancelled and we're skipping saga compensation (called from compensation), just return
    if (skipSagaCompensation && payment.status === 'cancelled') {
      this.logger.log(`✅ [CANCEL_PAYMENT] Payment ${paymentId} is already cancelled, skipping...`);
      return;
    }

    // Validate payment status - only pending payments can be cancelled
    if (payment.status !== 'pending') {
      throw new BadRequestException(`Cannot cancel payment with status: ${payment.status}. Only pending payments can be cancelled.`);
    }

    // Validate user has permission to cancel (only owner can cancel)
    if (payerId && payment.payerId !== payerId) {
      throw new BadRequestException('You do not have permission to cancel this payment');
    }

    // Update payment status FIRST to prevent infinite loop
    payment.status = 'cancelled';
    await this.paymentRepository.save(payment);
    this.logger.log(`✅ [CANCEL_PAYMENT] Payment ${paymentId} status updated to cancelled`);

    // Find the saga for this payment
    const saga = await this.sagaRepository.findOne({ where: { paymentId: paymentId } });
    
    if (saga && !skipSagaCompensation) {
      this.logger.log(`🔄 [CANCEL_PAYMENT] Found saga ${saga.id}, compensating completed steps...`);
      
      // Compensate completed steps in reverse order (but skip cancelPayment compensation to avoid loop)
      if (saga.completedSteps && saga.completedSteps.length > 0) {
        // Filter out createPayment step to avoid infinite loop
        const stepsToCompensate = saga.completedSteps.filter(step => step.compensation !== 'cancelPayment');
        if (stepsToCompensate.length > 0) {
          await this.compensateSaga(stepsToCompensate, {
            paymentId: paymentId,
            payerId: payment.payerId,
            studentId: payment.studentId,
            amount: payment.tuitionAmount,
            userEmail: saga.userEmail
          });
        }
      }
      
      // Update saga status
      saga.status = 'failed';
      saga.errorMessage = reason || 'Payment cancelled by user';
      await this.sagaRepository.save(saga);
      this.logger.log(`✅ [CANCEL_PAYMENT] Saga ${saga.id} marked as failed`);
    }

    // Clear OTP if exists
    try {
      await this.microservicesClient.clearOtp(paymentId);
      this.logger.log(`✅ [CANCEL_PAYMENT] OTP cleared for payment ${paymentId}`);
    } catch (error) {
      this.logger.warn(`⚠️ [CANCEL_PAYMENT] Failed to clear OTP: ${error.message}`);
      // Don't throw, OTP will expire anyway
    }

    // Release lock
    try {
      await this.releaseLock(payment.studentId);
      this.logger.log(`✅ [CANCEL_PAYMENT] Lock released for student ${payment.studentId}`);
    } catch (error) {
      this.logger.warn(`⚠️ [CANCEL_PAYMENT] Failed to release lock: ${error.message}`);
    }

    // Publish cancellation event
    try {
      await this.publishPaymentCancelledEvent(payment, reason || 'Payment cancelled by user');
      this.logger.log(`✅ [CANCEL_PAYMENT] Cancellation event published`);
    } catch (error) {
      this.logger.warn(`⚠️ [CANCEL_PAYMENT] Failed to publish event: ${error.message}`);
      // Don't throw, event publishing failure shouldn't block cancellation
    }
    
    this.logger.log(`🎉 [CANCEL_PAYMENT] Payment ${paymentId} cancelled successfully`);
  }
}



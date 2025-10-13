import { Controller, Post, Body, Get, Param, Logger, HttpException, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentService } from './payment.service';

@ApiTags('Payment')
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment with saga pattern' })
  @ApiResponse({ status: 201, description: 'Payment saga started successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  async createPayment(@Body() body: {
    payerId: string;
    studentId: string;
    amount: string;
    userEmail: string;
  }) {
    try {
      this.logger.log('Received payment creation request:', body);
      
      const sagaResult = await this.paymentService.processPaymentSaga(body);
      this.logger.log('Payment saga result:', sagaResult);
      
      return {
        success: sagaResult.success,
        sagaId: sagaResult.sagaId,
        paymentId: sagaResult.paymentId,
        message: sagaResult.message
      };
    } catch (error) {
      this.logger.error('Failed to create payment:', error);
      
      let errorMessage = 'Internal server error';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('not found') || error.message.includes('not exist')) {
          statusCode = HttpStatus.NOT_FOUND;
        } else if (error.message.includes('required') || error.message.includes('validation') || error.message.includes('mismatch') || error.message.includes('Insufficient balance')) {
          statusCode = HttpStatus.BAD_REQUEST;
        }
      }
      
      throw new HttpException(errorMessage, statusCode);
    }
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPayment(@Param('id') id: string) {
    try {
      const payment = await this.paymentService.findById(id);
      return {
        success: true,
        data: payment
      };
    } catch (error) {
      this.logger.error(`Failed to get payment ${id}:`, error);
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    }
  }

  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel payment' })
  @ApiResponse({ status: 200, description: 'Payment cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async cancelPayment(@Param('id') id: string) {
    try {
      await this.paymentService.cancelPayment(id);
      return {
        success: true,
        message: 'Payment cancelled successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to cancel payment ${id}:`, error);
      throw new HttpException('Failed to cancel payment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('payer/:payerId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payments by payer ID' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async getPaymentsByPayer(@Param('payerId') payerId: string) {
    try {
      const payments = await this.paymentService.getPaymentsByPayer(payerId);
      return {
        success: true,
        data: payments
      };
    } catch (error) {
      this.logger.error(`Failed to get payments for payer ${payerId}:`, error);
      throw new HttpException('Failed to retrieve payments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('student/:studentId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payments by student ID' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async getPaymentsByStudent(@Param('studentId') studentId: string) {
    try {
      const payments = await this.paymentService.getPaymentsByStudent(studentId);
      return {
        success: true,
        data: payments
      };
    } catch (error) {
      this.logger.error(`Failed to get payments for student ${studentId}:`, error);
      throw new HttpException('Failed to retrieve payments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('saga/:sagaId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get saga status by ID' })
  @ApiResponse({ status: 200, description: 'Saga status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Saga not found' })
  async getSagaStatus(@Param('sagaId') sagaId: string) {
    try {
      const saga = await this.paymentService.getSagaStatus(sagaId);
      if (!saga) {
        throw new HttpException('Saga not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: saga
      };
    } catch (error) {
      this.logger.error(`Failed to get saga status ${sagaId}:`, error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to retrieve saga status', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('sagas/all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all sagas' })
  @ApiResponse({ status: 200, description: 'Sagas retrieved successfully' })
  async getAllSagas() {
    try {
      const sagas = await this.paymentService.getAllSagas();
      return {
        success: true,
        data: sagas
      };
    } catch (error) {
      this.logger.error('Failed to get all sagas:', error);
      throw new HttpException('Failed to retrieve sagas', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('verify-otp')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify OTP for payment' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or expired' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async verifyOtp(@Body() body: { paymentId: string; otp: string }) {
    try {
      const result = await this.paymentService.verifyOtpAndCompletePayment(body.paymentId, body.otp);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Failed to verify OTP for payment ${body.paymentId}:`, error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to verify OTP', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }


  @Post('resend-otp/:paymentId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend/Regenerate OTP for payment' })
  @ApiResponse({ status: 200, description: 'OTP resent successfully' })
  @ApiResponse({ status: 400, description: 'OTP expired or not found' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async resendOtp(@Param('paymentId') paymentId: string, @Body() body: { userEmail: string }) {
    try {
      // Get userEmail from request body (passed from API Gateway)
      const { userEmail } = body;
      if (!userEmail) {
        throw new HttpException('User email not found in request', HttpStatus.BAD_REQUEST);
      }

      const result = await this.paymentService.resendOtpForPayment(paymentId, userEmail);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Failed to resend OTP for payment ${paymentId}:`, error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to resend OTP', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('otp-info/:paymentId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get OTP information for payment' })
  @ApiResponse({ status: 200, description: 'OTP info retrieved successfully' })
  @ApiResponse({ status: 404, description: 'OTP not found' })
  async getOtpInfo(@Param('paymentId') paymentId: string) {
    try {
      const result = await this.paymentService.getOtpInfo(paymentId);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Failed to get OTP info for payment ${paymentId}:`, error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to get OTP info', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}

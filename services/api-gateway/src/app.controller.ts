import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers, UseGuards, Req, Res, HttpException, HttpStatus } from '@nestjs/common';
import { SigninDto, SignupDto } from './dto/auth.dto';
import { CreatePaymentDto } from './dto/payment.dto';
import { GenerateOtpDto, VerifyOtpDto, ResendOtpDto } from './dto/otp.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AppService } from './app.service';
import { AccessTokenGuard, RefreshTokenGuard } from '@ibanking/shared';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';

@ApiTags('API Gateway')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for API Gateway and all services' })
  @ApiResponse({ status: 200, description: 'Health status of all services' })
  async healthCheck() {
    return this.appService.healthCheck();
  }

  // Auth Service Routes
  @Post('auth/signin')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'User sign in' })
  @ApiResponse({ status: 200, description: 'Sign in successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signin(@Body() body: SigninDto, @Headers() headers: any, @Res() res: Response) {
    // Map gateway DTO to auth-service expected payload
    const payload = { username: (body as any).username ?? (body as any).usernameOrEmail, password: body.password };
    const result = await this.appService.proxyRequest('auth', '/auth/signin', 'POST', payload, headers);
    
    // Forward cookies from auth service
    if (result.cookies) {
      result.cookies.forEach(cookie => {
        const [nameValue, ...options] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (name.trim() === 'refresh_token') {
          res.cookie('refresh_token', value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });
        }
      });
    }
    
    // Return only the data, not the cookies
    return res.json({ success: result.success, data: result.data });
  }

  @Post('auth/signup')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'User sign up' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async signup(@Body() body: SignupDto, @Headers() headers: any, @Res() res: Response) {
    const result = await this.appService.proxyRequest('auth', '/auth/signup', 'POST', body, headers);
    
    // Forward cookies from auth service
    if (result.cookies) {
      result.cookies.forEach(cookie => {
        const [nameValue, ...options] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (name.trim() === 'refresh_token') {
          res.cookie('refresh_token', value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });
        }
      });
    }
    
    // Return only the data, not the cookies
    return res.json({ success: result.success, data: result.data });
  }

  @Get('auth/refresh')
  @UseGuards(RefreshTokenGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  async refresh(@Req() req: Request, @Res() res: Response) {
    console.log('🔍 Refresh token request received');
    console.log('🍪 Cookies:', req.cookies);
    console.log('📋 Headers:', req.headers);
    
    // Forward cookies to auth service
    const headers = { ...req.headers };
    // Don't override cookie header if it already exists
    if (req.cookies?.refresh_token && !headers.cookie) {
      headers.cookie = `refresh_token=${req.cookies.refresh_token}`;
      console.log('✅ Forwarding refresh_token cookie');
    } else if (req.cookies?.refresh_token) {
      console.log('✅ Cookie already exists in headers');
    } else {
      console.log('❌ No refresh_token cookie found');
    }
    
    const result = await this.appService.proxyRequest('auth', '/auth/refresh', 'GET', {}, headers);
    // Handle cookie setting for refresh token
    const refreshToken = result?.data?.refreshToken;
    if (refreshToken) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }
    // Return only the data, not the cookies
    return res.json({ success: result.success, data: result.data });
  }

  @Post('auth/logout')
  @UseGuards(RefreshTokenGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Req() req: Request, @Res() res: Response) {
    const result = await this.appService.proxyRequest('auth', '/auth/logout', 'POST', {}, req.headers);
    res.clearCookie('refreshToken');
    // Return only the data, not the cookies
    return res.json({ success: result.success, data: result.data });
  }

  @Get('auth/logout-all')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logout from all devices successful' })
  async logoutAll(@Req() req: Request, @Res() res: Response) {
    const result = await this.appService.proxyRequest('auth', '/auth/logout-all', 'GET', {}, req.headers);
    res.clearCookie('refreshToken');
    // Return only the data, not the cookies
    return res.json({ success: result.success, data: result.data });
  }

  @Get('auth/me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@Req() req: Request) {
    console.log('🔍 /auth/me request received');
    console.log('📋 Headers:', req.headers);
    console.log('🔑 Authorization header:', req.headers.authorization);
    return this.appService.proxyRequest('auth', '/auth/me', 'GET', {}, req.headers);
  }

  // Student Service Routes
  @Get('tuition/:studentId')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Tuition by StudentID' })
  @ApiResponse({ status: 200, description: 'Student information retrieved' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async getStudent(@Param('studentId') studentId: string, @Req() req: Request) {
    return this.appService.proxyRequest('tuition', `/tuition/${studentId}`, 'GET', {}, req.headers);
  }

  @Get('tuition')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all Tuition' })
  @ApiResponse({ status: 200, description: 'Students list retrieved' })
  async getAllStudents(@Req() req: Request) {
    return this.appService.proxyRequest('tuition', '/tuition', 'GET', {}, req.headers);
  }

  // Saga Orchestrator Routes (replaces Payment Service)
  @Post('payments')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start payment processing saga' })
  @ApiResponse({ status: 201, description: 'Payment saga started successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  async createPayment(@Body() body: CreatePaymentDto, @Req() req: Request) {
    try {
      const user = (req as any).user;
      
      // Debug logging
      console.log('=== API Gateway Debug ===');
      console.log('User object:', JSON.stringify(user, null, 2));
      console.log('Request body:', JSON.stringify(body, null, 2));
      console.log('Request headers:', JSON.stringify(req.headers, null, 2));
      
      const payerId = user?.data?.id; // User object has nested data structure
      const userEmail = user?.data?.email;
      
      // Add validation and logging
      if (!payerId) {
        console.error('ERROR: User ID not found in request');
        console.error('User object keys:', Object.keys(user || {}));
        throw new Error('User ID not found in request. Please ensure you are authenticated.');
      }
      if (!userEmail) {
        console.error('ERROR: User email not found in request');
        console.error('User object keys:', Object.keys(user || {}));
        throw new Error('User email not found in request. Please ensure you are authenticated.');
      }
      
      console.log('Creating payment with data:', { payerId, userEmail, studentId: (body as any).studentId, amount: (body as any).tuitionAmount });
      
      const payload = { 
        payerId, 
        studentId: (body as any).studentId, 
        amount: (body as any).tuitionAmount,
        userEmail 
      };
      
      console.log('Payload being sent to saga orchestrator:', JSON.stringify(payload, null, 2));
      
      const result = await this.appService.proxyRequest('payment', '/payments/create', 'POST', payload, req.headers);
      console.log('Saga orchestrator response:', JSON.stringify(result, null, 2));
      
      // Handle response from payment service
      if (result.success === false) {
        // Direct error from payment service
        const errorMessage = result.error || result.data?.message || 'Payment processing failed';
        const statusCode = result.status || 400;
        
        console.error(`Payment service error: ${errorMessage} (${statusCode})`);
        throw new HttpException(errorMessage, statusCode);
      } else if (result.success === true && result.data?.success === false) {
        // Nested error in saga response
        const errorMessage = result.data?.message || 'Payment saga failed';
        const statusCode = 400;
        
        console.error(`Payment saga error: ${errorMessage} (${statusCode})`);
        throw new HttpException(errorMessage, statusCode);
      }
      
      return result;
    } catch (error) {
      console.error('Error in createPayment:', error);
      
      // Extract meaningful error message from the error
      let errorMessage = 'Internal server error';
      let statusCode = 500;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Map specific error types to appropriate HTTP status codes
        if (error.message.includes('not found') || error.message.includes('not exist')) {
          statusCode = 404;
        } else if (error.message.includes('required') || error.message.includes('validation') || error.message.includes('mismatch') || error.message.includes('Insufficient balance')) {
          statusCode = 400;
        } else if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
          statusCode = 401;
        }
      }
      
      console.error(`Returning error to client: ${errorMessage} (${statusCode})`);
      throw new HttpException(errorMessage, statusCode);
    }
  }


  // OTP Service Routes - Proxied through Payment Service
  @Post('payments/resend-otp/:paymentId')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend/Regenerate OTP for payment' })
  @ApiResponse({ status: 200, description: 'OTP resent successfully' })
  async resendOtp(@Param('paymentId') paymentId: string, @Req() req: Request) {
    try {
      const user = (req as any).user;
      
      // Debug logging
      console.log('=== API Gateway Resend OTP Debug ===');
      console.log('User object:', JSON.stringify(user, null, 2));
      console.log('Payment ID:', paymentId);
      
      const userEmail = user?.data?.email;
      
      // Add validation and logging
      if (!userEmail) {
        console.error('ERROR: User email not found in request');
        console.error('User object keys:', Object.keys(user || {}));
        throw new Error('User email not found in request. Please ensure you are authenticated.');
      }
      
      console.log('Resending OTP with user email:', userEmail);
      
      // Pass userEmail in request body to Payment Service
      const payload = { userEmail };
      
      return this.appService.proxyRequest('payment', `/payments/resend-otp/${paymentId}`, 'POST', payload, req.headers);
    } catch (error) {
      console.error('Error in resendOtp:', error);
      
      // Extract meaningful error message from the error
      let errorMessage = 'Internal server error';
      let statusCode = 500;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Map specific error types to appropriate HTTP status codes
        if (error.message.includes('not found') || error.message.includes('not exist')) {
          statusCode = 404;
        } else if (error.message.includes('required') || error.message.includes('validation') || error.message.includes('mismatch')) {
          statusCode = 400;
        } else if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
          statusCode = 401;
        }
      }
      
      console.error(`Returning error to client: ${errorMessage} (${statusCode})`);
      throw new HttpException(errorMessage, statusCode);
    }
  }

  @Post('otp/verify')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify OTP for payment' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyOtp(@Body() body: VerifyOtpDto, @Req() req: Request) {
    return this.appService.proxyRequest('payment', '/payments/verify-otp', 'POST', body, req.headers);
  }


  @Get('otp/info/:paymentId')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get OTP information for payment' })
  @ApiResponse({ status: 200, description: 'OTP info retrieved successfully' })
  async getOtpInfo(@Param('paymentId') paymentId: string, @Req() req: Request) {
    return this.appService.proxyRequest('payment', `/payments/otp-info/${paymentId}`, 'GET', {}, req.headers);
  }

  // Notification Service Routes
  // Notification endpoints removed - notification service only works as RPC worker
  // Notifications are sent automatically via RabbitMQ events
}



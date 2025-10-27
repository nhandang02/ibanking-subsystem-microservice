import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  // Service URLs
  private readonly services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://auth_service:4001',
    tuition: process.env.TUITION_SERVICE_URL || 'http://tuition_service:4006',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://payment_service:4007',
    // notification and otp services are accessed through payment service
  };

  async proxyRequest(service: string, path: string, method: string, data?: any, headers?: any) {
    const url = `${this.services[service]}${path}`;
    
    this.logger.log(`Proxying ${method} request to ${url}`);
    
    // Debug logging for payment requests
    if (service === 'payment' && path === '/payments/create') {
      console.log('=== AppService Debug ===');
      console.log('Service:', service);
      console.log('Path:', path);
      console.log('Method:', method);
      console.log('Data being sent:', JSON.stringify(data, null, 2));
      console.log('Headers:', JSON.stringify(headers, null, 2));
    }

    try {
      const incoming = headers || {};
      // Sanitize hop-by-hop headers to avoid Content-Length mismatch and connection issues
      const { ['content-length']: _cl, ['host']: _host, ['connection']: _conn, ['accept-encoding']: _enc, ...restHeaders } = incoming as any;

      const config: any = {
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          ...restHeaders,
        },
        timeout: 10000, // 10 seconds timeout
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }

      const response = await axios(config);
      return { 
        success: true, 
        data: response.data,
        cookies: response.headers['set-cookie'] // Forward cookies from service
      };
    } catch (error) {
      this.logger.error(`Failed to proxy request to ${url}:`, error.message);
      
      if (error.response) {
        // Service responded with error status
        const errorData = error.response.data;
        
        // Map auth service specific error fields
        let errorCode = errorData?.errorCode || errorData?.code;
        if (!errorCode && errorData?.error) {
          // Map auth service error field to errorCode
          switch (errorData.error) {
            case 'password':
              errorCode = 'INVALID_PASSWORD';
              break;
            case 'username':
              errorCode = 'INVALID_USERNAME';
              break;
            case 'user':
              errorCode = 'USER_NOT_FOUND';
              break;
            default:
              errorCode = 'AUTH_FAILED';
          }
        }
        
        return {
          success: false,
          status: error.response.status,
          error: errorData?.message || error.message,
          errorCode: errorCode,
          errorType: errorData?.errorType || errorData?.type || 'AuthError',
          details: errorData?.details || errorData?.stack,
          data: errorData,
          timestamp: new Date().toISOString(),
        };
      } else if (error.request) {
        // Service is unreachable
        return {
          success: false,
          status: 503,
          error: `Service ${service} is unavailable`,
          errorCode: 'SERVICE_UNAVAILABLE',
          errorType: 'ServiceError',
          timestamp: new Date().toISOString(),
        };
      } else {
        // Other error
        return {
          success: false,
          status: 500,
          error: error.message,
          errorCode: 'INTERNAL_ERROR',
          errorType: 'InternalError',
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  async healthCheck() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {},
    };

    // Check each service health
    for (const [serviceName, serviceUrl] of Object.entries(this.services)) {
      try {
        const response = await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
        health.services[serviceName] = {
          status: 'healthy',
          url: serviceUrl,
          responseTime: response.headers['x-response-time'] || 'unknown',
        };
      } catch (error) {
        health.services[serviceName] = {
          status: 'unhealthy',
          url: serviceUrl,
          error: error.message,
        };
      }
    }

    // Add info about RPC services
    health.services['notification'] = {
      status: 'rpc_worker',
      url: 'RabbitMQ RPC',
      note: 'Accessed through payment service',
    };
    
    health.services['otp'] = {
      status: 'rpc_worker', 
      url: 'RabbitMQ RPC',
      note: 'Accessed through payment service',
    };

    return health;
  }
}
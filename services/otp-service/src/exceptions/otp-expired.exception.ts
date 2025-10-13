import { HttpException, HttpStatus } from '@nestjs/common';

export class OtpExpiredException extends HttpException {
  constructor(transactionId: string) {
    super(
      {
        message: 'OTP has expired',
        error: 'OTP_EXPIRED',
        transactionId,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.GONE, // 410 Gone - resource is no longer available
    );
  }
}

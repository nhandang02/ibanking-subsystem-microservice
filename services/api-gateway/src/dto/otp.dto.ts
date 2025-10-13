import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateOtpDto {
  @ApiProperty({ example: 'payment-123', description: 'Payment ID' })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @ApiProperty({ example: 'alice@example.com', description: 'User email' })
  @IsEmail()
  userEmail!: string;

  @ApiProperty({ example: 'student-456', description: 'Student ID' })
  @IsString()
  @IsNotEmpty()
  studentId!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'payment-123', description: 'Payment ID' })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @ApiProperty({ example: '123456', description: 'OTP code' })
  @IsString()
  @IsNotEmpty()
  otp!: string;
}

export class ResendOtpDto {
  @ApiProperty({ example: 'payment-123', description: 'Payment ID' })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;
}



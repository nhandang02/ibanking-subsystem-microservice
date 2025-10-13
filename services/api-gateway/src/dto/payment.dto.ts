import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 'student-456' })
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @ApiProperty({ example: '1500000' })
  @IsNumberString()
  tuitionAmount!: string; // keep as string to match downstream services
}



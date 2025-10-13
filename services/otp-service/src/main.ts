import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create microservice application
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
      queue: 'otp_queue',
      queueOptions: {
        durable: true,
      },
      // Bind queue to exchanges for event listening
      bindings: [
        {
          exchange: 'payments',
          routingKey: 'payment.created',
        },
        {
          exchange: 'notifications',
          routingKey: 'otp.generated',
        },
        {
          exchange: 'notifications',
          routingKey: 'otp.resend_requested',
        }
      ],
    },
  });

  // Start the microservice
  await app.listen();
  console.log('OTP microservice is listening for messages...');
  console.log('Bound to exchanges: payments (payment.created), notifications (otp.generated, otp.resend_requested)');
}

bootstrap().catch((error) => {
  console.error('Failed to start OTP microservice:', error);
  process.exit(1);
});
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
      queue: 'notification_queue',
      queueOptions: {
        durable: true,
      },
      // Bind queue to exchanges for event listening
      bindings: [
        {
          exchange: 'notifications',
          routingKey: 'otp.generated',
        },
        {
          exchange: 'payments',
          routingKey: 'payment.created',
        }
      ],
    },
  });

  // Start the microservice
  await app.listen();
  console.log('Notification microservice is listening for messages...');
  console.log('Bound to exchanges: notifications (otp.generated), payments (payment.created)');
}

bootstrap().catch((error) => {
  console.error('Failed to start Notification microservice:', error);
  process.exit(1);
});
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create HTTP application
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors();
  
  // Enable HTTP server for API Gateway communication
  await app.listen(process.env.PORT || 4007);
  console.log(`Payment service HTTP server running on port ${process.env.PORT || 4007}`);
  
  // Create microservice for event handling
  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
      queue: 'payment_events_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  // Start microservice for event handling
  await app.startAllMicroservices();
  console.log('Payment service microservice (event handlers) started');
  
  console.log('Payment service running in hybrid mode: HTTP + Microservice');
}

bootstrap().catch((error) => {
  console.error('Failed to start Payment service:', error);
  process.exit(1);
});
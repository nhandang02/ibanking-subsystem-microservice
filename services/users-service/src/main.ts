import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { UsersService } from './users.service';

async function bootstrap() {
  // Create microservice application
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
      queue: 'users_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  // Seeding logic moved to standalone script src/seed.ts

  // Start the microservice
  await app.listen();
  console.log('Users microservice is listening for messages...');

  // Add legacy RabbitMQ consumer for backward compatibility
  const { connect } = await import('amqplib');
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  const conn = await connect(url);
  const ch = await conn.createChannel();

  // Ensure legacy queues exist
  await ch.assertQueue('users.get', { durable: true });
  await ch.assertQueue('users.findByEmail', { durable: true });
  await ch.assertQueue('users.findByUsername', { durable: true });
  await ch.assertQueue('users.create', { durable: true });
  await ch.assertQueue('users.comparePassword', { durable: true });
  await ch.assertQueue('users.deduct_balance', { durable: true });
  await ch.assertQueue('users.add_balance', { durable: true });
  await ch.assertQueue('users.update_balance', { durable: true });

  const usersService = app.get(UsersService);

  // Legacy consumer for users.get
  ch.consume('users.get', async (msg) => {
    if (!msg) return;
    try {
      const { userId } = JSON.parse(msg.content.toString());
      console.log(`🔍 [LEGACY] Getting user by ID: ${userId}`);
      const user = await usersService.findOne(userId);
      const response = { success: true, data: user };
      ch.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(response)), {
        correlationId: msg.properties.correlationId,
        contentType: 'application/json',
      });
      ch.ack(msg);
    } catch (error) {
      console.error('Legacy users.get error:', error);
      ch.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify({ 
        success: false, 
        error: error.message 
      })), {
        correlationId: msg.properties.correlationId,
        contentType: 'application/json',
      });
      ch.ack(msg);
    }
  });

  // Legacy consumer for users.deduct_balance
  ch.consume('users.deduct_balance', async (msg) => {
    if (!msg) return;
    try {
      const { userId, amount, transactionId } = JSON.parse(msg.content.toString());
      console.log(`🔍 [LEGACY] Deducting balance for user: ${userId}, amount: ${amount}`);
      const result = await usersService.deductBalance(userId, amount, transactionId);
      const response = { 
        success: result.success, 
        newBalance: result.newBalance, 
        error: result.error 
      };
      ch.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(response)), {
        correlationId: msg.properties.correlationId,
        contentType: 'application/json',
      });
      ch.ack(msg);
    } catch (error) {
      console.error('Legacy users.deduct_balance error:', error);
      ch.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify({ 
        success: false, 
        newBalance: '0', 
        error: error.message 
      })), {
        correlationId: msg.properties.correlationId,
        contentType: 'application/json',
      });
      ch.ack(msg);
    }
  });

  console.log('✅ [LEGACY] Legacy RabbitMQ consumers started for backward compatibility');
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});




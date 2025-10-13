import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { connect } from 'amqplib';
import { TuitionService } from './tuition.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Tuition Service API')
    .setDescription('Tuition Service for iBanking Tuition Payment System')
    .setVersion('1.0')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Get TuitionService instance
  const tuitionService = app.get(TuitionService);
  
  // Setup RabbitMQ RPC consumers
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  const conn = await connect(url);
  const ch = await conn.createChannel();
  ch.prefetch(1);

  // Seed students if enabled
  try {
    if ((process.env.SEED || '').toLowerCase() === 'true') {
      const repo: any = (tuitionService as any)['tuitionRepository'] || (tuitionService as any)['repo'];
      if (repo) {
        const count = await repo.count();
        if (count === 0) {
          await repo.save([
            repo.create({ studentId: '522H0006', studentName: 'Dang Thanh Nhan', amount: '1500000.00', isActive: true }),
            repo.create({ studentId: '522H0051', studentName: 'Nguyen Thanh Nhan', amount: '2000000.00', isActive: true }),
          ]);
          console.log('Seeded tuition-service with sample students');
        }
      }
    }
  } catch (e) {
    console.warn('Tuition seed skipped:', e?.message || e);
  }

  // Declare queue for tuition service
  await ch.assertQueue('students.lookup', { durable: true });
  await ch.assertQueue('students.get', { durable: true });
  await ch.assertQueue('students.create', { durable: true });
  await ch.assertQueue('tuition.update_amount', { durable: true });

  // Consumer for student lookup by ID
  await ch.consume('students.lookup', async (msg) => {
    if (msg) {
      try {
        const { studentId } = JSON.parse(msg.content.toString());
        const tuition = await tuitionService.findByStudentId(studentId);
        
        ch.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: true, data: tuition })),
          { correlationId: msg.properties.correlationId }
        );
        ch.ack(msg);
      } catch (error) {
        ch.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: false, error: error.message })),
          { correlationId: msg.properties.correlationId }
        );
        ch.ack(msg);
      }
    }
  });

  // Consumer for getting all students
  await ch.consume('students.get', async (msg) => {
    if (msg) {
      try {
        const tuitions = await tuitionService.getAllStudents();
        
        ch.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: true, data: tuitions })),
          { correlationId: msg.properties.correlationId }
        );
        ch.ack(msg);
      } catch (error) {
        ch.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: false, error: error.message })),
          { correlationId: msg.properties.correlationId }
        );
        ch.ack(msg);
      }
    }
  });

  // Consumer for creating student
  await ch.consume('students.create', async (msg) => {
    if (msg) {
      try {
        const studentData = JSON.parse(msg.content.toString());
        const tuition = await tuitionService.createStudent(studentData);
        
        ch.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: true, data: tuition })),
          { correlationId: msg.properties.correlationId }
        );
        ch.ack(msg);
      } catch (error) {
        ch.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: false, error: error.message })),
          { correlationId: msg.properties.correlationId }
        );
        ch.ack(msg);
      }
    }
  });

  // Consumer for updating tuition amount
  await ch.consume('tuition.update_amount', async (msg) => {
    if (msg) {
      try {
        const { studentId, amount } = JSON.parse(msg.content.toString());
        console.log(`🔍 [TUITION] Updating amount for student ${studentId} to ${amount}`);
        
        const tuition = await tuitionService.updateStudent(studentId, { amount });
        
        ch.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: true, data: tuition })),
          { correlationId: msg.properties.correlationId }
        );
        ch.ack(msg);
        console.log(`✅ [TUITION] Amount updated successfully for student ${studentId}`);
      } catch (error) {
        console.error(`❌ [TUITION] Failed to update amount:`, error.message);
        ch.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: false, error: error.message })),
          { correlationId: msg.properties.correlationId }
        );
        ch.ack(msg);
      }
    }
  });

  console.log('Tuition service RPC consumers started');
  console.log('Waiting for messages...');

  // Start HTTP server
  const port = process.env.PORT || 4006;
  await app.listen(port);
  console.log(`Tuition service HTTP server running on port ${port}`);

  // Keep the service running
  process.on('SIGINT', async () => {
    await ch.close();
    await conn.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start tuition service:', error);
  process.exit(1);
});



import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie parser
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('iBanking API Gateway')
    .setDescription('API Gateway for iBanking Tuition Payment System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Global error handling
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Global error:', err);
    res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      statusCode: err.status || 500,
    });
  });

  await app.listen(process.env.PORT || 4000);
  console.log(`API Gateway running on ${process.env.PORT || 4000}`);
  console.log(`Swagger documentation available at http://localhost:${process.env.PORT || 4000}/api`);
}

bootstrap().catch((error) => {
  console.error('Failed to start API Gateway:', error);
  process.exit(1);
});
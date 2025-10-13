import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Cookie parser
  app.use(cookieParser());
  
  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription('Authentication service for iBanking system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  await app.listen(process.env.PORT || 4001);
  console.log(`Auth service running on ${process.env.PORT || 4001}`);
  console.log(`Swagger documentation available at http://localhost:${process.env.PORT || 4001}/api/docs`);
}

bootstrap();



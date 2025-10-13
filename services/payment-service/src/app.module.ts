import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Payment } from './entities/payment.entity';
import { Saga } from './entities/saga.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentEventsController } from './payment-events.controller';
import { MicroservicesClientService } from './microservices-client.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'payment_db',
      entities: [Payment, Saga],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Payment, Saga]),
  ],
  controllers: [PaymentController, PaymentEventsController],
  providers: [PaymentService, MicroservicesClientService],
  exports: [PaymentService, MicroservicesClientService],
})
export class AppModule {}



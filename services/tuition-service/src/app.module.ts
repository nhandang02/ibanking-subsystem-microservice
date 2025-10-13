import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tuition } from './entities/tuition.entity';
import { TuitionService } from './tuition.service';
import { TuitionController } from './tuition.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'tuition_db',
      entities: [Tuition],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([Tuition]),
  ],
  controllers: [TuitionController],
  providers: [TuitionService],
  exports: [TuitionService],
})
export class AppModule {}



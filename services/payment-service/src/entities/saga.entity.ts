import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sagas')
export class Saga {
  @PrimaryColumn()
  id: string;

  @Column()
  paymentId: string;

  @Column()
  payerId: string;

  @Column()
  studentId: string;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: string;

  @Column()
  userEmail: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'completed' | 'failed' | 'compensating';

  @Column({ default: 0 })
  currentStepIndex: number;

  @Column('json')
  steps: Array<{
    id: string;
    action: string;
    compensation: string;
    status: 'pending' | 'completed' | 'failed';
    retryCount: number;
    maxRetries: number;
    error?: string;
    completedAt?: Date;
  }>;

  @Column('json', { nullable: true })
  completedSteps: Array<{
    id: string;
    action: string;
    compensation: string;
    status: 'completed';
    result?: any;
    completedAt: Date;
  }>;

  @Column('text', { nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

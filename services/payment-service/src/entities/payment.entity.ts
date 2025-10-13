import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryColumn('uuid')
  id: string;

  @Column('decimal', { precision: 15, scale: 2 })
  payerBalance: string;

  @Column('decimal', { precision: 15, scale: 2 })
  tuitionAmount: string;

  @Column('text')
  paymentTerms: string;

  @Column()
  payerId: string;

  @Column()
  studentId: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'completed' | 'failed' | 'cancelled';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}



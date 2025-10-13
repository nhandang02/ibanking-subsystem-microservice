import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tuition } from './entities/tuition.entity';

@Injectable()
export class TuitionService {
  private readonly logger = new Logger(TuitionService.name);

  constructor(
    @InjectRepository(Tuition)
    private readonly tuitionRepository: Repository<Tuition>,
  ) {}

  async findByStudentId(studentId: string): Promise<Tuition> {
    this.logger.log(`Looking up student with ID: ${studentId}`);
    
    // Normalize studentId to uppercase for consistent search
    const normalizedStudentId = studentId.toUpperCase();
    this.logger.log(`Normalized student ID: ${normalizedStudentId}`);
    
    const tuition = await this.tuitionRepository.findOne({
      where: { studentId: normalizedStudentId, isActive: true },
    });

    if (!tuition) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    this.logger.log(`Found student: ${tuition.studentName} with amount: ${tuition.amount}`);
    return tuition;
  }

  async getAllStudents(): Promise<Tuition[]> {
    return this.tuitionRepository.find({
      where: { isActive: true },
      order: { studentName: 'ASC' },
    });
  }

  async createStudent(studentData: {
    studentId: string;
    studentName: string;
    amount: string;
  }): Promise<Tuition> {
    const tuition = this.tuitionRepository.create(studentData);
    return this.tuitionRepository.save(tuition);
  }

  async updateStudent(studentId: string, updateData: Partial<Tuition>): Promise<Tuition> {
    const tuition = await this.findByStudentId(studentId);
    Object.assign(tuition, updateData);
    return this.tuitionRepository.save(tuition);
  }

  async deactivateStudent(studentId: string): Promise<void> {
    const normalizedStudentId = studentId.toUpperCase();
    await this.tuitionRepository.update(
      { studentId: normalizedStudentId },
      { isActive: false }
    );
  }
}



import { Controller, Get, Param, Post, Body, Put, Delete, HttpCode, HttpStatus, HttpException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TuitionService } from './tuition.service';
import { Tuition } from './entities/tuition.entity';

@ApiTags('Tuition')
@Controller('tuition')
export class TuitionController {
  private readonly logger = new Logger(TuitionController.name);

  constructor(private readonly tuitionService: TuitionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all students' })
  @ApiResponse({ status: 200, description: 'List of all active students', type: [Tuition] })
  async getAllStudents(): Promise<Tuition[]> {
    try {
      return await this.tuitionService.getAllStudents();
    } catch (error) {
      this.logger.error('Failed to get all students', error instanceof Error ? error.stack : undefined);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':studentId')
  @ApiOperation({ summary: 'Get student by ID' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ status: 200, description: 'Student information', type: Tuition })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async getStudent(@Param('studentId') studentId: string): Promise<Tuition> {
    try {
      return await this.tuitionService.findByStudentId(studentId);
    } catch (error) {
      this.logger.error(`Failed to get student ${studentId}`, error instanceof Error ? error.stack : undefined);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new student' })
  @ApiResponse({ status: 201, description: 'Student created successfully', type: Tuition })
  @HttpCode(HttpStatus.CREATED)
  async createStudent(@Body() studentData: {
    studentId: string;
    studentName: string;
    amount: string;
  }): Promise<Tuition> {
    try {
      return await this.tuitionService.createStudent(studentData);
    } catch (error) {
      this.logger.error('Failed to create student', error instanceof Error ? error.stack : undefined);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':studentId')
  @ApiOperation({ summary: 'Update student information' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ status: 200, description: 'Student updated successfully', type: Tuition })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async updateStudent(
    @Param('studentId') studentId: string,
    @Body() updateData: Partial<Tuition>
  ): Promise<Tuition> {
    try {
      return await this.tuitionService.updateStudent(studentId, updateData);
    } catch (error) {
      this.logger.error(`Failed to update student ${studentId}`, error instanceof Error ? error.stack : undefined);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':studentId')
  @ApiOperation({ summary: 'Deactivate student' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ status: 200, description: 'Student deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  @HttpCode(HttpStatus.OK)
  async deactivateStudent(@Param('studentId') studentId: string): Promise<{ message: string }> {
    try {
      await this.tuitionService.deactivateStudent(studentId);
      return { message: `Student ${studentId} has been deactivated` };
    } catch (error) {
      this.logger.error(`Failed to deactivate student ${studentId}`, error instanceof Error ? error.stack : undefined);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

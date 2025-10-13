import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @MessagePattern('users.get_user_by_id')
  async getUserById(@Payload() data: { userId: string }) {
    this.logger.log(`Getting user by ID: ${data.userId}`);
    try {
      const user = await this.usersService.findOne(data.userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      
      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          availableBalance: user.availableBalance
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get user by ID: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('users.deduct_balance')
  async deductBalance(@Payload() data: { userId: string; amount: string; transactionId: string }) {
    this.logger.log(`Deducting balance for user: ${data.userId}, amount: ${data.amount}`);
    try {
      const result = await this.usersService.deductBalance(data.userId, data.amount, data.transactionId);
      return result;
    } catch (error) {
      this.logger.error(`Failed to deduct balance: ${error.message}`);
      return { success: false, newBalance: '0', error: error.message };
    }
  }

  @MessagePattern('users.add_balance')
  async addBalance(@Payload() data: { userId: string; amount: string; transactionId: string }) {
    this.logger.log(`Adding balance for user: ${data.userId}, amount: ${data.amount}`);
    try {
      const result = await this.usersService.addBalance(data.userId, data.amount, data.transactionId);
      return result;
    } catch (error) {
      this.logger.error(`Failed to add balance: ${error.message}`);
      return { success: false, newBalance: '0', error: error.message };
    }
  }

  @MessagePattern('users.update_balance')
  async updateBalance(@Payload() data: { userId: string; newBalance: string }) {
    this.logger.log(`Updating balance for user: ${data.userId}, new balance: ${data.newBalance}`);
    try {
      const user = await this.usersService.updateBalance(data.userId, data.newBalance);
      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          availableBalance: user.availableBalance
        }
      };
    } catch (error) {
      this.logger.error(`Failed to update balance: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('users.findByEmail')
  async findByEmail(@Payload() data: { email: string }) {
    this.logger.log(`Finding user by email: ${data.email}`);
    try {
      const user = await this.usersService.findOneByEmail(data.email);
      return { success: true, data: user };
    } catch (error) {
      this.logger.error(`Failed to find user by email: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('users.findByUsername')
  async findByUsername(@Payload() data: { username: string }) {
    this.logger.log(`🔍 [DEBUG] Finding user by username: ${data.username}`);
    try {
      const user = await this.usersService.findOneByUsername(data.username);
      this.logger.log(`🔍 [DEBUG] User found:`, user ? { id: user.id, username: user.username, email: user.email } : 'null');
      return { success: true, data: user };
    } catch (error) {
      this.logger.error(`❌ [DEBUG] Failed to find user by username: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('users.create')
  async createUser(@Payload() data: { username: string; password: string; email: string; fullName: string; phoneNumber: string }) {
    this.logger.log(`Creating user: ${data.username}`);
    try {
      const user = await this.usersService.create(data);
      return { success: true, data: user };
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('users.comparePassword')
  async comparePassword(@Payload() data: { password: string; hash: string }) {
    this.logger.log(`Comparing password`);
    try {
      const isValid = await this.usersService.comparePasswords(data.password, data.hash);
      return { success: true, data: isValid };
    } catch (error) {
      this.logger.error(`Failed to compare password: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('users.get')
  async get(@Payload() data: { userId: string }) {
    this.logger.log(`Getting user: ${data.userId}`);
    try {
      const user = await this.usersService.findOne(data.userId);
      return { success: true, data: user };
    } catch (error) {
      this.logger.error(`Failed to get user: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @MessagePattern('users.findAll')
  async findAll() {
    this.logger.log(`🔍 [DEBUG] Finding all users`);
    try {
      const users = await this.usersService.findAll();
      this.logger.log(`🔍 [DEBUG] Found ${users.length} users:`, users.map(u => ({ id: u.id, username: u.username, email: u.email })));
      return { success: true, data: users };
    } catch (error) {
      this.logger.error(`❌ [DEBUG] Failed to find all users: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

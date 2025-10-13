import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async create(data: { username: string; password: string; email: string; fullName: string; phoneNumber: string; }): Promise<User> {
    const { username, password, email, fullName, phoneNumber } = data as any;

    if (!username || !password || !email || !fullName) {
      throw new Error('Missing required fields');
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [existingByEmail, existingByUsername] = await Promise.all([
      this.userRepository.findOne({ where: { email: normalizedEmail } }),
      this.userRepository.findOne({ where: { username } }),
    ]);

    if (existingByEmail) {
      throw new Error('Email already in use');
    }
    if (existingByUsername) {
      throw new Error('Username already in use');
    }

    const user = this.userRepository.create({
      username,
      passwordHash: await bcrypt.hash(password, 10),
      email: normalizedEmail,
      fullName,
      phoneNumber,
      availableBalance: '0.00',
    });
    return this.userRepository.save(user);
  }

  async comparePasswords(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async updateBalance(userId: string, newBalance: string): Promise<User> {
    const user = await this.findOne(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    user.availableBalance = newBalance;
    return this.userRepository.save(user);
  }

  async deductBalance(userId: string, amount: string, transactionId: string): Promise<{ success: boolean; newBalance: string; error?: string }> {
    try {
      const user = await this.findOne(userId);
      if (!user) {
        return { success: false, newBalance: '0', error: 'User not found' };
      }

      const currentBalance = parseFloat(user.availableBalance);
      const deductAmount = parseFloat(amount);
      
      if (currentBalance < deductAmount) {
        return { success: false, newBalance: user.availableBalance, error: 'Insufficient balance' };
      }

      const newBalance = (currentBalance - deductAmount).toFixed(2);
      user.availableBalance = newBalance;
      await this.userRepository.save(user);

      return { success: true, newBalance };
    } catch (error) {
      return { success: false, newBalance: '0', error: error.message };
    }
  }

  async addBalance(userId: string, amount: string, transactionId: string): Promise<{ success: boolean; newBalance: string; error?: string }> {
    try {
      const user = await this.findOne(userId);
      if (!user) {
        return { success: false, newBalance: '0', error: 'User not found' };
      }

      const currentBalance = parseFloat(user.availableBalance);
      const addAmount = parseFloat(amount);
      const newBalance = (currentBalance + addAmount).toFixed(2);
      
      user.availableBalance = newBalance;
      await this.userRepository.save(user);

      return { success: true, newBalance };
    } catch (error) {
      return { success: false, newBalance: '0', error: error.message };
    }
  }
}



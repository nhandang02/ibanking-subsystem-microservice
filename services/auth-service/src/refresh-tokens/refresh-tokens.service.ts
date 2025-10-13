import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import * as bcryptjs from 'bcryptjs';

@Injectable()
export class RefreshTokensService {
  private readonly logger = new Logger(RefreshTokensService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async create(userId: string, hashedToken: string): Promise<RefreshToken> {
    const refreshToken = this.refreshTokenRepository.create({
      userId,
      refreshToken: hashedToken,
    });
    return this.refreshTokenRepository.save(refreshToken);
  }

  async findByUserIdAndToken(
    userId: string,
    refreshToken: string,
  ): Promise<RefreshToken | null> {
    // Tìm tất cả refresh tokens của user
    const refreshTokenEntities = await this.refreshTokenRepository.find({ where: { userId } });

    if (!refreshTokenEntities || refreshTokenEntities.length === 0) return null;

    // So sánh với từng token đã hash
    for (const entity of refreshTokenEntities) {
      const isRefreshTokenValid = await bcryptjs.compare(
        refreshToken,
        entity.refreshToken,
      );
      
      if (isRefreshTokenValid) {
        return entity;
      }
    }

    return null;
  }

  async deleteByUserIdAndToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    this.logger.debug(`Deleting refresh token for userId: ${userId}`);
    const entity = await this.findByUserIdAndToken(userId, refreshToken);
    if (entity) {
      this.logger.debug(`Found refresh token entity with id: ${entity.id}`);
      await this.refreshTokenRepository.delete({ id: entity.id });
      this.logger.debug(`Refresh token deleted successfully`);
    } else {
      this.logger.warn(`No refresh token found for userId: ${userId}`);
    }
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await this.refreshTokenRepository.delete({ userId });
  }

  async updateToken(id: number, hashedToken: string): Promise<void> {
    await this.refreshTokenRepository.update(id, { refreshToken: hashedToken });
  }

  async compareTokens(plain: string, hashed: string): Promise<boolean> {
    try {
      return await bcryptjs.compare(plain, hashed);
    } catch (error) {
      this.logger.error('Token comparison failed:', error as any);
      throw new InternalServerErrorException('Token comparison failed');
    }
  }
}



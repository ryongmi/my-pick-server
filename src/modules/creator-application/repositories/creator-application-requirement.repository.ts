import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import {
  CreatorApplicationRequirementEntity,
  RequirementCategory,
  RequirementStatus,
} from '../entities/index.js';

@Injectable()
export class CreatorApplicationRequirementRepository extends BaseRepository<CreatorApplicationRequirementEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorApplicationRequirementEntity, dataSource);
  }

  async findByReviewId(reviewId: string): Promise<CreatorApplicationRequirementEntity[]> {
    return this.find({
      where: { reviewId },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }

  async findByReviewIdAndStatus(
    reviewId: string,
    status: RequirementStatus
  ): Promise<CreatorApplicationRequirementEntity[]> {
    return this.find({
      where: { reviewId, status },
      order: { priority: 'ASC' },
    });
  }

  async findByCategory(
    reviewId: string,
    category: RequirementCategory
  ): Promise<CreatorApplicationRequirementEntity[]> {
    return this.find({
      where: { reviewId, category },
      order: { priority: 'ASC' },
    });
  }

  async countByReviewIdAndStatus(reviewId: string, status: RequirementStatus): Promise<number> {
    return this.count({
      where: { reviewId, status },
    });
  }

  async countCompletedByReviewId(reviewId: string): Promise<number> {
    return this.count({
      where: { reviewId, isCompleted: true },
    });
  }

  async getTotalCountByReviewId(reviewId: string): Promise<number> {
    return this.count({
      where: { reviewId },
    });
  }

  async markAsCompleted(requirementId: string): Promise<void> {
    await this.update(requirementId, {
      isCompleted: true,
      status: RequirementStatus.COMPLETED,
      completedAt: new Date(),
    });
  }

  async updateStatus(requirementId: string, status: RequirementStatus): Promise<void> {
    const updateData: Partial<CreatorApplicationRequirementEntity> = { status };

    if (status === RequirementStatus.COMPLETED) {
      updateData.isCompleted = true;
      updateData.completedAt = new Date();
    }

    await this.update(requirementId, updateData);
  }

  async deleteByReviewId(reviewId: string): Promise<void> {
    await this.delete({ reviewId });
  }
}

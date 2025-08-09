import { Injectable, Logger } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { CreatorApplicationRequirementRepository } from '../repositories/index.js';
import {
  CreatorApplicationRequirementEntity,
  RequirementCategory,
  RequirementStatus,
} from '../entities/index.js';

export interface CreateRequirementDto {
  reviewId: string;
  requirement: string;
  category: RequirementCategory;
  priority?: number;
  estimatedDays?: number;
  description?: string;
  relatedUrl?: string;
}

export interface UpdateRequirementDto {
  requirement?: string;
  category?: RequirementCategory;
  status?: RequirementStatus;
  priority?: number;
  estimatedDays?: number;
  description?: string;
  relatedUrl?: string;
}

export interface RequirementProgress {
  reviewId: string;
  totalRequirements: number;
  completedRequirements: number;
  completionRate: number;
  pendingCount: number;
  inProgressCount: number;
  categoryBreakdown: Record<RequirementCategory, number>;
  averagePriority: number;
  estimatedTotalDays: number;
}

@Injectable()
export class CreatorApplicationRequirementService {
  private readonly logger = new Logger(CreatorApplicationRequirementService.name);

  constructor(private readonly requirementRepo: CreatorApplicationRequirementRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findByReviewId(reviewId: string): Promise<CreatorApplicationRequirementEntity[]> {
    return this.requirementRepo.findByReviewId(reviewId);
  }

  async findByReviewIdAndStatus(
    reviewId: string,
    status: RequirementStatus
  ): Promise<CreatorApplicationRequirementEntity[]> {
    return this.requirementRepo.findByReviewIdAndStatus(reviewId, status);
  }

  async findByCategory(
    reviewId: string,
    category: RequirementCategory
  ): Promise<CreatorApplicationRequirementEntity[]> {
    return this.requirementRepo.findByCategory(reviewId, category);
  }

  async createRequirement(dto: CreateRequirementDto, transactionManager?: EntityManager): Promise<CreatorApplicationRequirementEntity> {
    try {
      const requirement = this.requirementRepo.create({
        ...dto,
        status: RequirementStatus.PENDING,
        isCompleted: false,
        priority: dto.priority || 1,
      });

      const savedRequirement = await this.requirementRepo.saveEntity(requirement, transactionManager);

      this.logger.log('Requirement created successfully', {
        requirementId: savedRequirement.id,
        reviewId: dto.reviewId,
        category: dto.category,
        priority: dto.priority,
      });

      return savedRequirement;
    } catch (error: unknown) {
      this.logger.error('Failed to create requirement', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId: dto.reviewId,
        requirement: dto.requirement,
      });
      throw error;
    }
  }

  async updateRequirement(requirementId: string, dto: UpdateRequirementDto): Promise<void> {
    try {
      await this.requirementRepo.update(requirementId, dto);

      this.logger.log('Requirement updated successfully', {
        requirementId,
        status: dto.status,
        category: dto.category,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update requirement', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requirementId,
        updateData: dto,
      });
      throw error;
    }
  }

  async completeRequirement(requirementId: string): Promise<void> {
    try {
      await this.requirementRepo.markAsCompleted(requirementId);

      this.logger.log('Requirement completed', {
        requirementId,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to complete requirement', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requirementId,
      });
      throw error;
    }
  }

  async updateStatus(requirementId: string, status: RequirementStatus): Promise<void> {
    try {
      await this.requirementRepo.updateStatus(requirementId, status);

      this.logger.log('Requirement status updated', {
        requirementId,
        status,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update requirement status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requirementId,
        status,
      });
      throw error;
    }
  }

  async getRequirementProgress(reviewId: string): Promise<RequirementProgress> {
    try {
      const allRequirements = await this.findByReviewId(reviewId);
      const totalRequirements = allRequirements.length;

      if (totalRequirements === 0) {
        return this.createEmptyProgress(reviewId);
      }

      const completedRequirements = allRequirements.filter((r) => r.isCompleted).length;
      const completionRate = (completedRequirements / totalRequirements) * 100;

      const pendingCount = await this.requirementRepo.countByReviewIdAndStatus(
        reviewId,
        RequirementStatus.PENDING
      );

      const inProgressCount = await this.requirementRepo.countByReviewIdAndStatus(
        reviewId,
        RequirementStatus.IN_PROGRESS
      );

      const categoryBreakdown = this.calculateCategoryBreakdown(allRequirements);
      const averagePriority = this.calculateAveragePriority(allRequirements);
      const estimatedTotalDays = this.calculateEstimatedTotalDays(allRequirements);

      return {
        reviewId,
        totalRequirements,
        completedRequirements,
        completionRate: Math.round(completionRate * 100) / 100, // 소수점 2자리
        pendingCount,
        inProgressCount,
        categoryBreakdown,
        averagePriority,
        estimatedTotalDays,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get requirement progress', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId,
      });
      throw error;
    }
  }

  async getPendingRequirements(reviewId: string): Promise<CreatorApplicationRequirementEntity[]> {
    return this.findByReviewIdAndStatus(reviewId, RequirementStatus.PENDING);
  }

  async getHighPriorityRequirements(
    reviewId: string,
    maxPriority: number = 2
  ): Promise<CreatorApplicationRequirementEntity[]> {
    try {
      const allRequirements = await this.findByReviewId(reviewId);
      return allRequirements.filter((r) => r.priority <= maxPriority && !r.isCompleted);
    } catch (error: unknown) {
      this.logger.error('Failed to get high priority requirements', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId,
        maxPriority,
      });
      throw error;
    }
  }

  async createBulkRequirements(
    reviewId: string,
    requirements: Omit<CreateRequirementDto, 'reviewId'>[]
  ): Promise<CreatorApplicationRequirementEntity[]> {
    try {
      const createdRequirements = [];

      for (const req of requirements) {
        const created = await this.createRequirement({ ...req, reviewId });
        createdRequirements.push(created);
      }

      this.logger.log('Bulk requirements created', {
        reviewId,
        count: requirements.length,
      });

      return createdRequirements;
    } catch (error: unknown) {
      this.logger.error('Failed to create bulk requirements', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId,
        count: requirements.length,
      });
      throw error;
    }
  }

  async deleteRequirement(requirementId: string): Promise<void> {
    try {
      await this.requirementRepo.delete(requirementId);

      this.logger.log('Requirement deleted', {
        requirementId,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to delete requirement', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requirementId,
      });
      throw error;
    }
  }

  async deleteAllByReviewId(reviewId: string): Promise<void> {
    try {
      await this.requirementRepo.deleteByReviewId(reviewId);

      this.logger.log('All requirements deleted for review', {
        reviewId,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to delete requirements for review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId,
      });
      throw error;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private createEmptyProgress(reviewId: string): RequirementProgress {
    return {
      reviewId,
      totalRequirements: 0,
      completedRequirements: 0,
      completionRate: 0,
      pendingCount: 0,
      inProgressCount: 0,
      categoryBreakdown: {} as Record<RequirementCategory, number>,
      averagePriority: 0,
      estimatedTotalDays: 0,
    };
  }

  private calculateCategoryBreakdown(
    requirements: CreatorApplicationRequirementEntity[]
  ): Record<RequirementCategory, number> {
    const breakdown = {} as Record<RequirementCategory, number>;

    for (const category of Object.values(RequirementCategory)) {
      breakdown[category] = requirements.filter((r) => r.category === category).length;
    }

    return breakdown;
  }

  private calculateAveragePriority(requirements: CreatorApplicationRequirementEntity[]): number {
    if (requirements.length === 0) return 0;

    const totalPriority = requirements.reduce((sum, req) => sum + req.priority, 0);
    return Math.round((totalPriority / requirements.length) * 100) / 100;
  }

  private calculateEstimatedTotalDays(requirements: CreatorApplicationRequirementEntity[]): number {
    const incompletedRequirements = requirements.filter((r) => !r.isCompleted);
    return incompletedRequirements.reduce((sum, req) => sum + (req.estimatedDays || 1), 0);
  }
}

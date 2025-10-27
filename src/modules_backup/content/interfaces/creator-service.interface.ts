import { CreatorEntity } from '../../creator/entities/index.js';

export interface CreatorServiceInterface {
  findByIds(creatorIds: string[]): Promise<CreatorEntity[]>;
}

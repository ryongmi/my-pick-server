import { CreatorEntity } from '../../creator/entities/index.js';

export interface ICreatorService {
  findByIds(creatorIds: string[]): Promise<CreatorEntity[]>;
}

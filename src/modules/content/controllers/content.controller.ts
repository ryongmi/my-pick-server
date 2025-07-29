import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { UserInteractionService } from '@modules/user-interaction/index.js';

import { ContentService } from '../services';
import { ContentSearchQueryDto, ContentSearchResultDto, ContentDetailDto } from '../dto';
import {
  BookmarkContentDto,
  LikeContentDto,
  WatchContentDto,
  RateContentDto,
} from '../../user-interaction/dto';
import { PaginatedResult } from '../../creator/dto';

// TODO: @krgeobuk/authorization 패키지 설치 후 import
// import { AuthGuard, CurrentUser, RequirePermission } from '@krgeobuk/authorization';

// 임시 인터페이스 (실제로는 @krgeobuk/authorization에서 import)
interface UserInfo {
  id: string;
  email: string;
  roles: string[];
}

// 임시 데코레이터 (실제로는 @krgeobuk/authorization에서 import)
const AuthGuard = () => () => {};
const CurrentUser = () => (target: any, propertyKey: string, parameterIndex: number) => {};
const RequirePermission = (permission: string) => () => {};

@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly userInteractionService: UserInteractionService
  ) {}

  @Get()
  async getContent(
    @Query() query: ContentSearchQueryDto
    // @CurrentUser() user?: UserInfo,
  ): Promise<PaginatedResult<ContentSearchResultDto>> {
    // const userId = user?.id;
    const userId = undefined; // 임시
    return this.contentService.searchContent(query, userId);
  }

  @Get('trending')
  async getTrendingContent(
    @Query('hours') hours: number = 24,
    @Query('limit') limit: number = 50
  ): Promise<ContentSearchResultDto[]> {
    return this.contentService.getTrendingContent(hours, limit);
  }

  @Get('recent')
  async getRecentContent(
    @Query('creatorIds') creatorIds: string,
    @Query('limit') limit: number = 20
  ): Promise<ContentSearchResultDto[]> {
    const creatorIdArray = creatorIds ? creatorIds.split(',') : [];
    return this.contentService.getRecentContent(creatorIdArray, limit);
  }

  @Get(':id')
  async getContentById(
    @Param('id', ParseUUIDPipe) contentId: string
    // @CurrentUser() user?: UserInfo,
  ): Promise<ContentDetailDto> {
    // const userId = user?.id;
    const userId = undefined; // 임시
    return this.contentService.getContentById(contentId, userId);
  }

  @Post(':id/bookmark')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  async bookmarkContent(
    @Param('id', ParseUUIDPipe) contentId: string
    // @CurrentUser() user: UserInfo,
  ): Promise<void> {
    // 임시 사용자 ID (실제로는 CurrentUser 데코레이터에서 가져옴)
    const userId = 'temp-user-id';

    // 콘텐츠 존재 확인
    await this.contentService.findByIdOrFail(contentId);

    const dto: BookmarkContentDto = {
      userId,
      contentId,
    };

    await this.userInteractionService.bookmarkContent(dto);
  }

  @Delete(':id/bookmark')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  async removeBookmark(
    @Param('id', ParseUUIDPipe) contentId: string
    // @CurrentUser() user: UserInfo,
  ): Promise<void> {
    // 임시 사용자 ID (실제로는 CurrentUser 데코레이터에서 가져옴)
    const userId = 'temp-user-id';

    await this.userInteractionService.removeBookmark(userId, contentId);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  async likeContent(
    @Param('id', ParseUUIDPipe) contentId: string
    // @CurrentUser() user: UserInfo,
  ): Promise<void> {
    // 임시 사용자 ID (실제로는 CurrentUser 데코레이터에서 가져옴)
    const userId = 'temp-user-id';

    // 콘텐츠 존재 확인
    await this.contentService.findByIdOrFail(contentId);

    const dto: LikeContentDto = {
      userId,
      contentId,
    };

    await this.userInteractionService.likeContent(dto);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  async removeLike(
    @Param('id', ParseUUIDPipe) contentId: string
    // @CurrentUser() user: UserInfo,
  ): Promise<void> {
    // 임시 사용자 ID (실제로는 CurrentUser 데코레이터에서 가져옴)
    const userId = 'temp-user-id';

    await this.userInteractionService.removeLike(userId, contentId);
  }

  @Post(':id/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  async watchContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body() body: { watchDuration?: number } = {}
    // @CurrentUser() user: UserInfo,
  ): Promise<void> {
    // 임시 사용자 ID (실제로는 CurrentUser 데코레이터에서 가져옴)
    const userId = 'temp-user-id';

    // 콘텐츠 존재 확인
    await this.contentService.findByIdOrFail(contentId);

    const dto: WatchContentDto = {
      userId,
      contentId,
      watchDuration: body.watchDuration,
    };

    await this.userInteractionService.watchContent(dto);
  }

  @Post(':id/rate')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  async rateContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body() body: { rating: number }
    // @CurrentUser() user: UserInfo,
  ): Promise<void> {
    // 임시 사용자 ID (실제로는 CurrentUser 데코레이터에서 가져옴)
    const userId = 'temp-user-id';

    // 콘텐츠 존재 확인
    await this.contentService.findByIdOrFail(contentId);

    const dto: RateContentDto = {
      userId,
      contentId,
      rating: body.rating,
    };

    await this.userInteractionService.rateContent(dto);
  }
}

// 북마크 관리 컨트롤러
@Controller('content/bookmarks')
export class ContentBookmarkController {
  constructor(
    private readonly contentService: ContentService,
    private readonly userInteractionService: UserInteractionService
  ) {}

  @Get()
  // @UseGuards(AuthGuard)
  async getBookmarkedContent(
    // @CurrentUser() user: UserInfo,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20
  ): Promise<ContentSearchResultDto[]> {
    // 임시 사용자 ID (실제로는 CurrentUser 데코레이터에서 가져옴)
    const userId = 'temp-user-id';

    const bookmarkedContentIds = await this.userInteractionService.getBookmarkedContentIds(userId);

    if (bookmarkedContentIds.length === 0) {
      return [];
    }

    const contents = await this.contentService.findByIds(bookmarkedContentIds);

    return contents.map((content) =>
      plainToInstance(
        ContentSearchResultDto,
        {
          ...content,
          isBookmarked: true,
        },
        {
          excludeExtraneousValues: true,
        }
      )
    );
  }
}

// 사용자별 상호작용 관리
@Controller('users/:userId/interactions')
export class UserContentInteractionController {
  constructor(
    private readonly userInteractionService: UserInteractionService,
    private readonly contentService: ContentService
  ) {}

  @Get('content')
  // @UseGuards(AuthGuard)
  async getUserInteractedContent(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<ContentSearchResultDto[]> {
    const interactions = await this.userInteractionService.getInteractionsByUserId(userId);
    const contentIds = interactions.map((interaction) => interaction.contentId);

    if (contentIds.length === 0) {
      return [];
    }

    const contents = await this.contentService.findByIds(contentIds);

    return contents.map((content) => {
      const interaction = interactions.find((i) => i.contentId === content.id);
      return plainToInstance(
        ContentSearchResultDto,
        {
          ...content,
          isBookmarked: interaction?.isBookmarked,
          isLiked: interaction?.isLiked,
          watchedAt: interaction?.watchedAt,
          rating: interaction?.rating,
        },
        {
          excludeExtraneousValues: true,
        }
      );
    });
  }

  @Get('bookmarks')
  // @UseGuards(AuthGuard)
  async getUserBookmarks(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<{ contentIds: string[] }> {
    const contentIds = await this.userInteractionService.getBookmarkedContentIds(userId);
    return { contentIds };
  }

  @Get('likes')
  // @UseGuards(AuthGuard)
  async getUserLikes(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<{ contentIds: string[] }> {
    const contentIds = await this.userInteractionService.getLikedContentIds(userId);
    return { contentIds };
  }

  @Get('watch-history')
  // @UseGuards(AuthGuard)
  async getWatchHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit: number = 50
  ): Promise<ContentSearchResultDto[]> {
    const interactions = await this.userInteractionService.getWatchHistory(userId, limit);
    const contentIds = interactions.map((interaction) => interaction.contentId);

    if (contentIds.length === 0) {
      return [];
    }

    const contents = await this.contentService.findByIds(contentIds);

    return contents.map((content) => {
      const interaction = interactions.find((i) => i.contentId === content.id);
      return plainToInstance(
        ContentSearchResultDto,
        {
          ...content,
          watchedAt: interaction?.watchedAt,
          watchDuration: interaction?.watchDuration,
          rating: interaction?.rating,
        },
        {
          excludeExtraneousValues: true,
        }
      );
    });
  }

  @Get('stats')
  // @UseGuards(AuthGuard)
  async getUserInteractionStats(@Param('userId', ParseUUIDPipe) userId: string): Promise<{
    totalInteractions: number;
    bookmarkCount: number;
    likeCount: number;
  }> {
    const [totalInteractions, bookmarkCount, likeCount] = await Promise.all([
      this.userInteractionService.getUserInteractionCount(userId),
      this.userInteractionService.getUserBookmarkCount(userId),
      this.userInteractionService.getUserLikeCount(userId),
    ]);

    return {
      totalInteractions,
      bookmarkCount,
      likeCount,
    };
  }
}


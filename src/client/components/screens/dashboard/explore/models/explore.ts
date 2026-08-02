import type { ArticlePreview } from './articlePreview';
import type { SearchSuggestion } from './search';
import type { SideQuest } from './sidequest';
import type { Topic } from './topic';
import type { TrendingCourse } from './trending-course';

export interface AvatarPreview {
  id: string;
  image: string;
  alt?: string;
}

export interface ExploreModel {
  searchSuggestions: SearchSuggestion[];
  peopleFinishing: TrendingCourse[];
  topics: Topic[];
  trendingSideQuests: SideQuest[];
  recentlyPublished: ArticlePreview[];
}

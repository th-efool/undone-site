import type {ArticlePreview} from "./article"
import type {ContinueExploringItem} from "./continue-exploring"
import type {SearchSuggestion} from "./search"
import type {SideQuest} from "./sidequest"
import type {TopicChip} from "./topic"
import type {TrendingCourse} from "./trending-course"

export interface AvatarPreview {
    id: string
    image: string
    alt: string
}

export interface IconBadge {
    icon: string
    label: string
}

export interface ExploreModel {
    searchSuggestions: SearchSuggestion[]
    continueExploring: ContinueExploringItem[]
    peopleFinishing: TrendingCourse[]
    topics: TopicChip[]
    trendingSideQuests: SideQuest[]
    recentlyPublished: ArticlePreview[]
}

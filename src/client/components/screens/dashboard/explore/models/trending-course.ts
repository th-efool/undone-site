import type {AvatarPreview} from "./explore"

export interface TrendingCourse {
    id: string
    title: string
    creatorName: string
    thumbnail: string
    durationLabel: string
    learnerCountLabel: string
    featuredLearners: AvatarPreview[]
    rating: number
    trending: boolean
}

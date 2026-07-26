import type {AvatarPreview} from "./explore"

export interface SideQuest {
    id: string
    title: string
    description: string
    artwork: string
    participantCount: string
    featuredParticipants: AvatarPreview[]
    commitment: string
}

import type { ReactNode } from "react";

export interface ContinueExploringItem {
    id: string
    cohortId?: string
    title: string
    icon: ReactNode
    subtitle: string
    progressPercent?: number
    statusColor?: string
}

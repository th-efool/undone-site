import {
    BookOpen,
    CheckCircle2,
    ChevronDown,
    Circle,
    ClipboardCheck,
    Clock3,
    Compass,
    FileText,
    Flame,
    Heart,
    Leaf,
    Lock,
    Map,
    MessageSquareText,
    PenSquare,
    Play,
    Target,
    type LucideIcon,
} from "lucide-react";

import type { CohortIcon } from "../../../models";

export type QuestlineUtilityIcon = CohortIcon | "chevronDown" | "circle" | "lock" | "play";

interface QuestlineIconProps {
    icon: QuestlineUtilityIcon;
    className?: string;
    size?: number;
}

const iconMap = {
    assignment: ClipboardCheck,
    book: BookOpen,
    brain: BookOpen,
    calendar: Clock3,
    check: CheckCircle2,
    chevronDown: ChevronDown,
    circle: Circle,
    clock: Clock3,
    compass: Compass,
    file: FileText,
    flame: Flame,
    heart: Heart,
    leaf: Leaf,
    lesson: Map,
    lock: Lock,
    notes: MessageSquareText,
    play: Play,
    project: PenSquare,
    target: Target,
} satisfies Record<QuestlineUtilityIcon, LucideIcon>;

export function QuestlineIcon({ icon, className, size = 18 }: QuestlineIconProps) {
    const Icon = iconMap[icon];

    return <Icon className={className} size={size} strokeWidth={2.2} />;
}

import {
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Compass,
  FileText,
  Flame,
  Heart,
  Leaf,
  Map,
  MessageSquareText,
  NotebookText,
  PenSquare,
  Target,
  type LucideIcon,
} from 'lucide-react';

import type { CohortIcon } from '../../../../models';

interface OverviewIconProps {
  icon: CohortIcon;
  className?: string;
}

const iconMap = {
  assignment: ClipboardCheck,
  book: BookOpen,
  brain: Brain,
  calendar: Calendar,
  check: CheckCircle2,
  clock: Clock3,
  compass: Compass,
  file: FileText,
  flame: Flame,
  heart: Heart,
  leaf: Leaf,
  lesson: Map,
  notes: MessageSquareText,
  project: PenSquare,
  target: Target,
} satisfies Record<CohortIcon, LucideIcon>;

export function OverviewIcon({ icon, className }: OverviewIconProps) {
  const Icon = iconMap[icon] ?? NotebookText;

  return (
    <Icon
      className={className}
      size={20}
      strokeWidth={2.2}
    />
  );
}

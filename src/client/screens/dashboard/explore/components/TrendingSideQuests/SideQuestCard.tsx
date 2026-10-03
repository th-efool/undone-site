import { CohortCard } from '@/src/client/components/global/CohortCard';
import type { SideQuest } from '../../models';

export interface SideQuestCardProps {
  item: SideQuest;
  className?: string;
  size?: 'standard' | 'compact';
}

export function SideQuestCard({ item, className, size = 'standard' }: SideQuestCardProps) {
  return <CohortCard item={item} className={className} size={size} />;
}

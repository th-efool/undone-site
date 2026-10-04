import type { LucideIcon } from 'lucide-react';
import { Compass, House, MessageCircle, NotebookPen, Play } from 'lucide-react';

export interface SidebarItemConfig {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  hidden?: boolean;
}

// Inactive items kept for reference / re-enabling in the future
export const INACTIVE_SIDEBAR_ITEMS: readonly SidebarItemConfig[] = [
  {
    href: '/message',
    label: 'Messages',
    icon: MessageCircle,
    disabled: true,
    hidden: true,
  },
  {
    href: '/explore',
    label: 'Explore',
    icon: Compass,
    disabled: true,
    hidden: true,
  },
  {
    href: '/notes',
    label: 'Notes',
    icon: NotebookPen,
    disabled: true,
    hidden: true,
  },
] as const;

export const SIDEBAR_ITEMS: readonly SidebarItemConfig[] = [
  {
    href: '/play',
    label: 'Play',
    icon: Play,
  },
  {
    href: '/home',
    label: 'Home',
    icon: House,
  },
] as const;


import { Compass, House, MessageCircle, NotebookPen, Play } from 'lucide-react';

export const SIDEBAR_ITEMS = [
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
  {
    href: '/message',
    label: 'Messages',
    icon: MessageCircle,
  },
  {
    href: '/explore',
    label: 'Explore',
    icon: Compass,
  },
  {
    href: '/notes',
    label: 'Notes',
    icon: NotebookPen,
  },
] as const;

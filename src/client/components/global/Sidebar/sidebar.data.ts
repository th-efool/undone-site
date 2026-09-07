import { Compass, House, Play } from 'lucide-react';

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
    href: '/explore',
    label: 'Explore',
    icon: Compass,
  },
] as const;

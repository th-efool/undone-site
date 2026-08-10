import { ConversationFilter, SidebarTab } from '../models';

export const sidebarTabs: { id: SidebarTab; label: string }[] = [
  { id: 'community', label: 'Community' },
  { id: 'dm', label: 'DMs' },
];

export const conversationFilters: { id: ConversationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'pinned', label: 'Pinned' },
];

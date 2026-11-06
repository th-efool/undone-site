import { useEffect } from 'react';

export function useRoomRefresh(channel: string | undefined, refresh: () => void) {
  useEffect(() => {
    if (!channel) return;
    const listener = (event: Event) => {
      if ((event as CustomEvent<string>).detail === channel) refresh();
    };
    window.addEventListener('studyroom:resync',listener);
    return () => window.removeEventListener('studyroom:resync',listener);
  },[channel,refresh]);
}

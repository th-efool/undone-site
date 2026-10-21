import { ChannelTab } from '../../../../models';
import styles from './ChannelTabs.module.css';

interface Props {
  channels: ChannelTab[];
  selectedChannel: string;
  onSelectChannel?: (channelId: string) => void;
}

export function ChannelTabs({ channels, selectedChannel, onSelectChannel }: Props) {
  return (
    <nav className={styles.tabs}>
      {channels.map((channel) => (
        <button
          key={channel.id}
          type="button"
          className={channel.id === selectedChannel ? styles.active : ''}
          onClick={() => onSelectChannel?.(channel.id)}
        >
          {channel.label}
          {channel.unreadCount !== undefined && channel.unreadCount > 0 && (
            <span className={styles.badge}>{channel.unreadCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

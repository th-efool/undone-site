import { ChannelTab } from '../../../../models';
import styles from './ChannelTabs.module.css';

interface Props {
  channels: ChannelTab[];
  selectedChannel: string;
}
export function ChannelTabs({ channels, selectedChannel }: Props) {
  return (
    <nav className={styles.tabs}>
      {channels.map((channel) => (
        <button
          key={channel.id}
          type="button"
          className={channel.id === selectedChannel ? styles.active : ''}
        >
          {channel.label}
        </button>
      ))}
    </nav>
  );
}

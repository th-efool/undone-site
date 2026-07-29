/* eslint-disable @next/next/no-img-element */
import { PinnedMessage } from '../../../../models';
import styles from './PinnedMessages.module.css';
interface Props {
  items: PinnedMessage[];
}
export function PinnedMessages({ items }: Props) {
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <article key={item.id}>
          <img
            src={item.author.avatar}
            alt=""
          />
          <div>
            <strong>{item.author.name}</strong>
            <p>{item.preview}</p>
            <time>{item.timestamp}</time>
          </div>
        </article>
      ))}
    </div>
  );
}

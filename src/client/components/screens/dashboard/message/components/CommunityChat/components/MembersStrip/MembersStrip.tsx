import Image from 'next/image';
/* eslint-disable @next/next/no-img-element */
import { PersonPreview } from '../../../../models';
import styles from './MembersStrip.module.css';
interface Props {
  members: PersonPreview[];
  count: number;
}
export function MembersStrip({ members, count }: Props) {
  return (
    <div className={styles.strip}>
      {members.slice(0, 5).map((member) => (
        <span key={member.id}>
          <Image width={400} height={300}
            src={member.avatar}
            alt={member.name}
           />
          {member.online && <i />}
        </span>
      ))}
      <b>+{Math.max(count - members.length, 0)}</b>
    </div>
  );
}

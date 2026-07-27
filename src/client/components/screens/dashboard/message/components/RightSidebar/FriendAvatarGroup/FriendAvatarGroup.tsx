import { PersonPreview } from "../../../models";
import styles from "./FriendAvatarGroup.module.css";
interface Props{friends:PersonPreview[];overflow:number;}
export function FriendAvatarGroup({friends,overflow}:Props){return <div className={styles.group}>{friends.slice(0,5).map((friend)=><span key={friend.id}><img src={friend.avatar} alt={friend.name}/>{friend.online&&<i/>}</span>)}<b>+{overflow}</b></div>}

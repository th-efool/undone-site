import { ChallengeCard, PersonPreview, UpcomingEvent } from "../../models";
import { DailyChallenge } from "./DailyChallenge/DailyChallenge";
import { FriendsOnline } from "./FriendsOnline/FriendsOnline";
import { UpcomingEvents } from "./UpcomingEvents/UpcomingEvents";
import styles from "./RightSidebar.module.css";
interface Props{upcomingEvents:UpcomingEvent[];challenge:ChallengeCard;friendsOnline:PersonPreview[];}
export function RightSidebar({upcomingEvents,challenge,friendsOnline}:Props){return <aside className={styles.sidebar}><UpcomingEvents items={upcomingEvents}/><DailyChallenge challenge={challenge}/><FriendsOnline friends={friendsOnline}/></aside>}

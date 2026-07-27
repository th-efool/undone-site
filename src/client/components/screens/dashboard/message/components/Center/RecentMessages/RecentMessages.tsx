import { RecentMessage } from "../../../models";
import { EmptyState } from "../../shared";
import { RecentMessageItem } from "../RecentMessageItem/RecentMessageItem";
import styles from "./RecentMessages.module.css";
interface Props{items:RecentMessage[];}
export function RecentMessages({items}:Props){return <section className={styles.section}><header><h2>Recent Messages</h2><button type="button">Mark all as read</button></header>{items.length?<div>{items.map((item)=><RecentMessageItem key={item.id} message={item}/>)}</div>:<EmptyState title="No recent messages" message="Search did not match any learning updates yet."/>}</section>}

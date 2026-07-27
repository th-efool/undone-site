import { X } from "lucide-react";
import { DMConversationModel } from "../../../../models";
import { AboutCard } from "../AboutCard/AboutCard";
import { NotificationCard } from "../NotificationCard/NotificationCard";
import { QuickActions } from "../QuickActions/QuickActions";
import { ResourceList } from "../ResourceList/ResourceList";
import { UserHero } from "../UserHero/UserHero";
import styles from "./DMProfileSidebar.module.css";
interface Props { conversation: DMConversationModel; }
export function DMProfileSidebar({ conversation }: Props) {return <aside className={styles.sidebar}><button type="button" className={styles.close} aria-label="Close profile"><X size={22}/></button><UserHero user={conversation.user}/><QuickActions/><AboutCard user={conversation.user}/><ResourceList resources={conversation.resources}/><NotificationCard notifications={conversation.notifications}/></aside>}

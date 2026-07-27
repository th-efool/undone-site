import { DMConversationModel } from "../../models";
import { DMComposer } from "./components/DMComposer/DMComposer";
import { DMHeader } from "./components/DMHeader/DMHeader";
import { DMProfileSidebar } from "./components/DMProfileSidebar/DMProfileSidebar";
import { MessageTimeline } from "./components/MessageTimeline/MessageTimeline";
import styles from "./DMConversation.module.css";
interface Props { conversation: DMConversationModel; onBack(): void; }
export function DMConversation({ conversation, onBack }: Props) {return <div className={styles.dm}><main className={styles.main}><DMHeader user={conversation.user} onBack={onBack}/><MessageTimeline conversation={conversation}/><DMComposer/></main><DMProfileSidebar conversation={conversation}/></div>}

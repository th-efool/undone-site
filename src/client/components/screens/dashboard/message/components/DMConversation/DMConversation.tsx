import { DMConversationModel } from "../../models";
import { DMComposer } from "./components/DMComposer/DMComposer";
import { DMHeader } from "./components/DMHeader/DMHeader";
import { DMProfileSidebar } from "./components/DMProfileSidebar/DMProfileSidebar";
import { MessageTimeline } from "./components/MessageTimeline/MessageTimeline";
import styles from "./DMConversation.module.css";

interface Props {
    conversation: DMConversationModel;
    draft: string;
    scrollTop: number;
    onBack(): void;
    onDraftChange(value: string): void;
    onScrollChange(scrollTop: number): void;
    onSend(): void;
}

export function DMConversation({ conversation, draft, scrollTop, onBack, onDraftChange, onScrollChange, onSend }: Props) {
    return (
        <div className={styles.dm}>
            <main className={styles.main}>
                <DMHeader user={conversation.user} onBack={onBack} />
                <MessageTimeline conversation={conversation} scrollTop={scrollTop} onScrollChange={onScrollChange} />
                <DMComposer value={draft} onChange={onDraftChange} onSend={onSend} />
            </main>
            <DMProfileSidebar conversation={conversation} />
        </div>
    );
}

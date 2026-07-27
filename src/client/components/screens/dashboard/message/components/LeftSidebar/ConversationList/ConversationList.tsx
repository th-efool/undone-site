import { ConversationPreview } from "../../../models";
import { ConversationItem } from "../ConversationItem/ConversationItem";
import styles from "./ConversationList.module.css";

interface Props {
    conversations: ConversationPreview[];
    onSelectConversation(conversation: ConversationPreview): void;
}

export function ConversationList({ conversations, onSelectConversation }: Props) {
    return (
        <div className={styles.list}>
            {conversations.map((conversation) => (
                <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    onSelect={onSelectConversation}
                />
            ))}
        </div>
    );
}

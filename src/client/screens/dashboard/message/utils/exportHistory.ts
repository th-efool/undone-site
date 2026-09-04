import { db } from '../../../../db';
import Conversation from '../../../../db/models/Conversation';
import Message from '../../../../db/models/Message';
import Attachment from '../../../../db/models/Attachment';
import ConversationMember from '../../../../db/models/ConversationMember';

export async function exportHistory() {
  const conversations = await db.get<Conversation>('conversations').query().fetch();
  const members = await db.get<ConversationMember>('conversation_members').query().fetch();
  const messages = await db.get<Message>('messages').query().fetch();
  const attachments = await db.get<Attachment>('attachments').query().fetch();

  const exportData = {
    conversations: conversations.map((c) => c._raw),
    members: members.map((m) => m._raw),
    messages: messages.map((m) => m._raw),
    attachments: attachments.map((a) => a._raw),
  };

  const jsonString = JSON.stringify(exportData);
  
  // Trigger browser download
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chat-history-export.json';
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importHistory(jsonString: string) {
  const data = JSON.parse(jsonString);
  const { conversations = [], members = [], messages = [], attachments = [] } = data;

  const batches: import('@nozbe/watermelondb').Model[] = [];

  // Get existing IDs
  const existingConvIds = new Set((await db.get<Conversation>('conversations').query().fetch()).map((c) => c.id));
  const existingMemberIds = new Set((await db.get<ConversationMember>('conversation_members').query().fetch()).map((m) => m.id));
  const existingMsgIds = new Set((await db.get<Message>('messages').query().fetch()).map((m) => m.id));
  const existingAttachmentIds = new Set((await db.get<Attachment>('attachments').query().fetch()).map((a) => a.id));

  for (const raw of conversations) {
    if (!existingConvIds.has(raw.id)) batches.push(db.get<Conversation>('conversations').prepareCreateFromDirtyRaw(raw));
  }
  for (const raw of members) {
    if (!existingMemberIds.has(raw.id)) batches.push(db.get<ConversationMember>('conversation_members').prepareCreateFromDirtyRaw(raw));
  }
  for (const raw of messages) {
    if (!existingMsgIds.has(raw.id)) batches.push(db.get<Message>('messages').prepareCreateFromDirtyRaw(raw));
  }
  for (const raw of attachments) {
    if (!existingAttachmentIds.has(raw.id)) batches.push(db.get<Attachment>('attachments').prepareCreateFromDirtyRaw(raw));
  }

  if (batches.length > 0) {
    await db.write(async () => {
      await db.batch(...batches);
    });
  }
}

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'conversations',
      columns: [
        { name: 'type', type: 'string' },
        { name: 'title', type: 'string', isOptional: true },
        { name: 'community_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'conversation_members',
      columns: [
        { name: 'conversation_id', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'last_read_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'conversation_id', type: 'string' },
        { name: 'author_id', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'client_id', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'attachments',
      columns: [
        { name: 'message_id', type: 'string' },
        { name: 'url', type: 'string' },
        { name: 'file_name', type: 'string' },
        { name: 'file_type', type: 'string' },
      ],
    }),
  ],
});

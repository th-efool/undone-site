import { Model } from '@nozbe/watermelondb';
import { field, date, relation, children, readonly } from '@nozbe/watermelondb/decorators';

export default class Message extends Model {
  static table = 'messages';
  static associations = {
    conversations: { type: 'belongs_to', key: 'conversation_id' },
    attachments: { type: 'has_many', foreignKey: 'message_id' }
  } as const;

  @field('author_id') authorId!: string;
  @field('content') content!: string;
  @field('client_id') clientId?: string;
  @field('status') status!: string;
  @readonly @date('created_at') createdAt!: Date;
  @relation('conversations', 'conversation_id') conversation!: any;
  @children('attachments') attachments!: any;
}

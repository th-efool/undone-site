import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';

export default class ConversationMember extends Model {
  static table = 'conversation_members';
  static associations = {
    conversations: { type: 'belongs_to', key: 'conversation_id' }
  } as const;

  @field('user_id') userId!: string;
  @field('role') role!: string;
  @date('last_read_at') lastReadAt?: Date;
  @relation('conversations', 'conversation_id') conversation!: any;
}

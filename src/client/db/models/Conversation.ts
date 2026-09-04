import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';

export default class Conversation extends Model {
  static table = 'conversations';
  static associations = {
    messages: { type: 'has_many', foreignKey: 'conversation_id' },
    conversation_members: { type: 'has_many', foreignKey: 'conversation_id' }
  } as const;

  @field('type') type!: string;
  @field('title') title?: string;
  @field('community_id') communityId?: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @children('messages') messages!: any;
  @children('conversation_members') members!: any;
}

import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

export default class Attachment extends Model {
  static table = 'attachments';
  static associations = {
    messages: { type: 'belongs_to', key: 'message_id' }
  } as const;

  @field('url') url!: string;
  @field('file_name') fileName!: string;
  @field('file_type') fileType!: string;
  @relation('messages', 'message_id') message!: any;
}

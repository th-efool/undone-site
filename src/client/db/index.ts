import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import Conversation from './models/Conversation';
import ConversationMember from './models/ConversationMember';
import Message from './models/Message';
import Attachment from './models/Attachment';
import { Capacitor } from '@capacitor/core';

const adapter = Capacitor.isNativePlatform() 
  ? new SQLiteAdapter({
      schema,
      jsi: true,
      onSetUpError: error => console.error("Database setup error", error)
    })
  : new LokiJSAdapter({
      schema,
      useWebWorker: false,
      useIncrementalIndexedDB: true,
      onSetUpError: error => console.error("LokiJS setup error", error)
    });

export const db = new Database({
  adapter,
  modelClasses: [
    Conversation,
    ConversationMember,
    Message,
    Attachment,
  ],
});

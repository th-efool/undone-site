import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { prisma } from '../db/postgres/client';

export const hocuspocus = new Hocuspocus({
  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const doc = await prisma.noteDocument.findUnique({
          where: { noteId: documentName },
        });
        return doc?.document ? Buffer.from(doc.document) : null;
      },
      store: async ({ documentName, state }) => {
        const docBuffer = Buffer.from(state);
        await prisma.noteDocument.upsert({
          where: { noteId: documentName },
          create: { noteId: documentName, document: docBuffer },
          update: { document: docBuffer },
        });
      },
    }),
  ],
  async onAuthenticate() {
    // Accept all connections for now
    return {
      user: {
        id: 'mock-user-id'
      }
    };
  }
});

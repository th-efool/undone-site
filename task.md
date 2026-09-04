# Task Updates

## Wave 1 (Foundation)
- [x] Database & Schema (Server-Side) - Prisma schema updated with Conversation, ConversationMember, PendingMessage, DeviceToken. Run `prisma generate`.
- [x] Real-Time Transport - Added Centrifugo to `render.yaml`.
- [x] Client-Side Database - Created WatermelonDB schemas and models for Conversation, ConversationMember, Message, Attachment. Setup LokiJS/SQLite adapters in `index.ts`.

## Wave 2 (Backend APIs)
- [ ] Implement `src/app/api/chat/centrifugo-token/route.ts`
- [ ] Implement `src/app/api/chat/send/route.ts`
- [ ] Implement `src/app/api/chat/ack/route.ts`
- [ ] Implement `src/app/api/chat/sync/route.ts`

## Wave 3 (Frontend Refactor)
- [ ] Strip localStorage from `useMessage.ts` and use `@nozbe/watermelondb/react` hooks
- [ ] Add `exportHistory.ts` utility

## Wave 4 (Mobile/Capacitor)
- [ ] Request push notification permissions in `CapacitorBridge.tsx`
- [ ] Send token to backend
- [ ] Deep link into Message screen

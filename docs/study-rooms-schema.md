# Global Study Rooms: Database Schema & Architecture

If you've built React applications, you're familiar with the concept of local vs. global state. You can think of community-specific chat channels as "local state" (scoped to a specific community page), whereas Study Rooms are true **global state**. 

Study rooms like "Fireplace" or "Library" are persistent, global voice sessions that any user can drop into at any time, completely independently of the communities or cohorts they belong to. 

Here is the database architecture to support this feature, tailored for a developer transitioning from frontend to backend.

## Why are we storing this in PostgreSQL?

You might be wondering: *If this is a real-time voice channel, doesn't WebRTC or our media server handle this?*

Yes and no. **WebRTC handles the actual audio/video streaming**, but WebRTC is "dumb" when it comes to your application's business logic. It doesn't know what the "Fireplace" room is, what its thumbnail looks like, or what the user's avatar is. 

PostgreSQL acts as the **Source of Truth for Metadata**. Our database's job is to:
1. Provide the list of available rooms to the frontend so you can render the UI.
2. Track exactly *who* is in *what* room at any given millisecond. 
3. Provide a historical record (e.g., tracking total hours a user spent studying).

## The Prisma Schema

To model this, we need two tables: `StudyRoom` (the room itself) and `RoomParticipant` (the act of a user being inside that room). 

```prisma
model StudyRoom {
  id          String   @id @default(cuid())
  title       String   // e.g., "Fireplace", "Library", "Seaside"
  thumbnail   String   // URL to the illustration/cover image for the room
  status      String   // e.g., "Warm & Cozy", "Deep Focus"
  
  // Performance optimization: 
  // While we *could* calculate the online count on the fly by counting related 
  // RoomParticipants, caching it as a hard number is much faster for the DB 
  // when thousands of users are fetching the room list simultaneously.
  onlineCount Int      @default(0) 

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // The relation tying this room to the people currently inside it
  participants RoomParticipant[]

  @@map("study_rooms")
}

// This is what backend developers call a "Join Table". 
// It bridges the many-to-many relationship between Users and StudyRooms.
model RoomParticipant {
  id          String   @id @default(cuid())
  
  // Foreign keys linking back to the primary records
  userId      String   @unique // 👈 Enforces that a user can only be in ONE room globally at a time
  studyRoomId String

  // The Prisma relation definitions (assumes you have a User model)
  // `onDelete: Cascade` means if the room is deleted, boot everyone out of the DB automatically.
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  room        StudyRoom @relation(fields: [studyRoomId], references: [id], onDelete: Cascade)

  // Track when they dropped in. 
  // On the frontend, you can use this to render: "Agrim has been studying for 2 hours"
  joinedAt    DateTime  @default(now())

  // We index the room ID because the most common database query we will run is: 
  // "Get me all the users currently in room X"
  @@index([studyRoomId])
  
  @@map("room_participants")
}
```

## Backend Concepts in Frontend Terms

### 1. The "Join Table" (`RoomParticipant`)
In React, if you want a list of users in a room, you might just keep an array of user objects in your state: `setRoomUsers([...roomUsers, newUser])`.

Relational databases don't like arrays. Instead, we use a **Join Table**. `RoomParticipant` is essentially an event log that says: *"User A is currently sitting in Room B"*. When a user clicks "Join Room" on the frontend, your API creates a `RoomParticipant` record. When they click "Leave", your API deletes that record. 

### 2. Indexes (`@@index`)
Think of a database query like `Array.prototype.find()`. If you have a million users, scanning the entire array to find who is in the "Fireplace" room is slow (O(n) time complexity). 

Adding `@@index([studyRoomId])` is like telling PostgreSQL to maintain a predefined Map or Dictionary under the hood: `Map<RoomId, Users[]>`. When you ask for the users in the "Fireplace" room, the database can instantly fetch them in O(1) time.

### 3. Constraints (`@unique`)
By putting `@unique` on the `userId` inside the `RoomParticipant` table, we are strictly enforcing application logic at the database level. Even if a user opens two browser tabs and clicks "Join" on two different rooms at the exact same time, PostgreSQL will reject the second request. It guarantees our frontend state can never get out of sync with reality.

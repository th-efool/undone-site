# 🚀 SideQuestHQ

**SideQuestHQ** is a modern, cohort-based microlearning platform that transforms long-form content (YouTube playlists, courses, and web resources) into interactive, bite-sized learning feeds. 

Experience learning like scrolling a feed — chunked lessons, interactive questlines, real-time progress tracking, and distraction-free media playback.

---

## 📖 Substantial Documentation

If you are a reviewer or technical judge, please review our crisp, concise, and substantial architecture documentation located in the `docs/` folder. These files outline the depth of the engineering decisions powering SideQuestHQ:

- 🏛️ **[Core Architecture & Engine](./docs/ARCHITECTURE.md)**: Deep dive into the TikTok-style media feed, Client/Server state boundaries, and NextAuth v5 database session flow.
- 🗄️ **[Relational Curriculum Schema](./docs/prisma-schema-cohort.md)**: Why we use strict relational models (`Cohort` -> `Season` -> `Lesson`) over flat JSON, ensuring data integrity at scale.
- 🎧 **[Global Study Rooms & Concurrency](./docs/study-rooms-schema.md)**: How we use PostgreSQL unique constraints and join tables to guarantee isolated real-time states for global voice rooms.

---

## ✨ Key Features

- 📱 **TikTok-Style Microlearning Feed (`/play`)**
  - Continuous vertical feed of chunked video lessons (5–10 min chunks).
  - Native YouTube UI eradication (no overlays, zero distractions) via the IFrame API.
  - Intuitive gesture & keyboard controls (scroll wheel, arrow keys, screen tap to play/pause).

- 🛠️ **Cohort Creation Wizard**
  - Build cohorts directly from YouTube playlists, individual videos, or web articles.
  - Automatic chunking algorithms convert long tutorials into digestible learning quests.
  - Live Overview page preview while editing identity, cover images, and classifications.

- 🗺️ **Interactive Questlines (`/cohort/[id]/questline`)**
  - Season-based curriculum mapping with granular chunk breakdowns.
  - Active cohort tracking synced directly with your daily learning dashboard.

---

## 🛠️ Tech Stack (3-Tier Architecture)

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Components)
- **Database Engine**: PostgreSQL managed via **Prisma ORM**
- **Authentication**: **NextAuth v5** with persistent database sessions (`@auth/prisma-adapter`)
- **Language**: TypeScript
- **Styling**: Vanilla CSS Modules (Glassmorphic dark design system)
- **Mobile Native Shell**: **Capacitor** (Bridging the web app to native Android/iOS)

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js 18+** and a running **PostgreSQL** instance.

### 2. Installation
```bash
git clone https://github.com/th-efool/sidequesthq-site.git
cd sidequesthq-site
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 Android App (Capacitor)

See [docs/ANDROID.md](./docs/ANDROID.md) for building and releasing the native Android shell.

Quick start:
```bash
npm run mobile:build
npm run mobile:open
```

---

## 📄 License
MIT License. Created for modern explorers on SideQuestHQ.

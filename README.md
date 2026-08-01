# 🚀 SideQuestHQ

**SideQuestHQ** is a modern, cohort-based microlearning platform that transforms YouTube playlists, courses, and web resources into interactive, bite-sized learning feeds. 

Experience learning like scrolling a feed — chunked lessons, interactive questlines, real-time progress tracking, and distraction-free media playback.

---

## ✨ Features

- 📱 **TikTok-Style Microlearning Feed (`/play`)**
  - Continuous vertical feed of chunked video lessons (5–10 min chunks).
  - Native YouTube UI eradication (no overlays, zero distractions).
  - Intuitive gesture & keyboard controls (scroll wheel, arrow keys, screen tap to play/pause).
  - Real-time chunk completion tracking and seamless auto-advance.

- 🛠️ **Cohort Creation Wizard**
  - Build cohorts directly from YouTube playlists, individual videos, or web articles.
  - Automatic chunking algorithms convert long tutorials into digestible learning quests.
  - Live Overview page preview while editing identity, cover images, and classifications.

- 🗺️ **Interactive Questlines (`/cohort/[id]/questline`)**
  - Season-based curriculum mapping.
  - Granular chunk breakdown with direct timestamp links (e.g., `&t=234s`).
  - Active cohort tracking synced directly with your daily learning dashboard.

- 📚 **Rich Cohort Catalog & Real Data**
  - Includes real YouTube curriculum cohorts:
    - **DSA — Only What's Needed** (Kunal Kushwaha's Java DSA Series)
    - **Operating Systems** (CodeHelp - by Babbar)
    - **Networking** (Network Kings & Industry Interviews)
    - **Celtic Mythology** (Tuatha Dé Danann, The Morrigan, Cú Chulainn)
    - **Rajvansh: Dynasties Of India** (Mauryas, Cholas, Guptas)

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Vanilla CSS Modules (Glassmorphic dark design system)
- **Media**: YouTube IFrame API (Custom distraction-free surface)
- **Icons**: Lucide React

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js 18+** installed.

### 2. Installation
```bash
git clone https://github.com/your-username/sidequesthq-site.git
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

```
src/
├── app/                  # Next.js App Router pages (/home, /play, /cohort, /create)
├── client/
│   ├── components/       # Screens & UI Components (Play, Cohort, CreateCohort, Home)
│   ├── mock/             # Real cohort definitions & data seeds
│   └── repositories/     # Local state management & feed algorithm repositories
└── shared/               # Shared TypeScript types for curriculum & feed engine
```

---

## 📄 License
MIT License. Created for modern explorers on SideQuestHQ.

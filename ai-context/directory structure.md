Directory Structure
├── .gitignore
├── .idea/
│ ├── .gitignore
│ ├── compiler.xml
│ ├── inspectionProfiles/
│ │ └── Project_Default.xml
│ ├── modules.xml
│ ├── sidequesthq-site.iml
│ └── vcs.xml
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── ai-context/
│ ├── design-css-tokens.md
│ ├── directory structure.md
│ └── hero-section-guidelines.md
├── eslint.config.mjs
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── public/
│ ├── file.svg
│ ├── globe.svg
│ ├── images/
│ │ ├── hero-poster.webp
│ │ ├── icons/
│ │ │ ├── 128/
│ │ │ │ ├── Ai.webp
│ │ │ │ ├── Article.webp
│ │ │ │ ├── Book.webp
│ │ │ │ ├── Bookmark.webp
│ │ │ │ ├── Calender.webp
│ │ │ │ ├── Headphone.webp
│ │ │ │ ├── Youtube.webp
│ │ │ │ └── floating-logo.webp
│ │ │ ├── 512/
│ │ │ │ ├── Ai.webp
│ │ │ │ ├── Article.webp
│ │ │ │ ├── Book.webp
│ │ │ │ ├── Bookmark.webp
│ │ │ │ ├── Calender.webp
│ │ │ │ ├── Headphone.webp
│ │ │ │ └── Youtube.webp
│ │ │ ├── coursera-white.webp
│ │ │ ├── coursera.webp
│ │ │ ├── icon-style-ref.png
│ │ │ ├── youtube-white.webp
│ │ │ └── youtube.webp
│ │ ├── landing/
│ │ │ ├── a.webp
│ │ │ ├── b.webp
│ │ │ ├── before-sleep.webp
│ │ │ ├── c.webp
│ │ │ ├── cab-ride.webp
│ │ │ ├── coffee-break.webp
│ │ │ ├── d.webp
│ │ │ ├── e.webp
│ │ │ ├── hand.webp
│ │ │ ├── metro-ride.webp
│ │ │ ├── phone.webp
│ │ │ ├── screen.webp
│ │ │ └── waiting.webp
│ │ └── logos/
│ │ ├── floating-logo.png
│ │ ├── floating-logo.webp
│ │ └── sidequesthq-logo.webp
│ ├── videos/
│ │ └── hero.webm
│ └── window.svg
├── src/
│ ├── app/
│ │ ├── (auth)/
│ │ │ └── auth/
│ │ │ └── page.tsx
│ │ ├── (dashboard)/
│ │ │ ├── dashboard/
│ │ │ │ └── page.tsx
│ │ │ ├── profile/
│ │ │ │ └── page.tsx
│ │ │ ├── sessions/
│ │ │ │ ├── [id]/
│ │ │ │ │ └── page.tsx
│ │ │ │ └── page.tsx
│ │ │ └── settings/
│ │ │ └── page.tsx
│ │ ├── (landing)/
│ │ │ ├── layout.tsx
│ │ │ ├── loading.tsx
│ │ │ └── page.tsx
│ │ ├── favicon.ico
│ │ ├── globals.css
│ │ ├── layout.tsx
│ │ └── styles/
│ │ ├── accessibility.css
│ │ ├── buttons.css
│ │ ├── forms.css
│ │ ├── layout.css
│ │ ├── print.css
│ │ ├── reset.css
│ │ ├── tokens.css
│ │ └── typography.css
│ ├── client/
│ │ ├── components/
│ │ │ ├── global/
│ │ │ │ ├── Footer/
│ │ │ │ │ ├── Footer.module.css
│ │ │ │ │ └── Footer.tsx
│ │ │ │ ├── Footer.tsx
│ │ │ │ ├── Logo/
│ │ │ │ │ ├── Logo.module.css
│ │ │ │ │ └── Logo.tsx
│ │ │ │ ├── Logo.tsx
│ │ │ │ ├── Navbar/
│ │ │ │ │ ├── Navbar.module.css
│ │ │ │ │ └── Navbar.tsx
│ │ │ │ ├── Navbar.tsx
│ │ │ │ └── layout/
│ │ │ │ ├── Cluster.tsx
│ │ │ │ ├── Container.tsx
│ │ │ │ ├── Layout.module.css
│ │ │ │ ├── Section.tsx
│ │ │ │ ├── SectionHeader.tsx
│ │ │ │ ├── Stack.tsx
│ │ │ │ ├── Surface.tsx
│ │ │ │ └── layoutTokens.ts
│ │ │ ├── screens/
│ │ │ │ ├── auth/
│ │ │ │ │ └── .gitkeep
│ │ │ │ ├── dashboard/
│ │ │ │ │ └── .gitkeep
│ │ │ │ └── landing/
│ │ │ │ ├── .gitkeep
│ │ │ │ ├── 01-hero/
│ │ │ │ │ ├── Hero.module.css
│ │ │ │ │ ├── Hero.tsx
│ │ │ │ │ ├── heroContent.module.css
│ │ │ │ │ ├── heroContent.tsx
│ │ │ │ │ ├── heroFloatingContentIcons.module.css
│ │ │ │ │ ├── heroFloatingContentIcons.tsx
│ │ │ │ │ ├── heroNavbar.module.css
│ │ │ │ │ ├── heroNavbar.tsx
│ │ │ │ │ ├── heroScene.tsx
│ │ │ │ │ ├── heroTicker.module.css
│ │ │ │ │ ├── heroTicker.tsx
│ │ │ │ │ └── index.ts
│ │ │ │ ├── 02-ikigai/
│ │ │ │ │ ├── CalendarMonth/
│ │ │ │ │ │ ├── CalendarMonth.module.css
│ │ │ │ │ │ ├── CalendarMonth.tsx
│ │ │ │ │ │ ├── calendarData.ts
│ │ │ │ │ │ ├── calendarMonth.types.ts
│ │ │ │ │ │ ├── calendarTypes.ts
│ │ │ │ │ │ └── calendarUtils.ts
│ │ │ │ │ ├── FeatureSection.module.css
│ │ │ │ │ ├── FeatureSection.tsx
│ │ │ │ │ ├── Ikigai.tsx
│ │ │ │ │ ├── ProgressSection.module.css
│ │ │ │ │ ├── ProgressSection.tsx
│ │ │ │ │ ├── ikigaiTimeline.module.css
│ │ │ │ │ ├── ikigaiTimeline.tsx
│ │ │ │ │ ├── index.ts
│ │ │ │ │ ├── learningList.module.css
│ │ │ │ │ └── learningList.tsx
│ │ │ │ ├── 03-problem/
│ │ │ │ │ ├── Problem.tsx
│ │ │ │ │ └── index.ts
│ │ │ │ ├── 04-community/
│ │ │ │ │ ├── Community.tsx
│ │ │ │ │ └── index.ts
│ │ │ │ ├── 05-Features/
│ │ │ │ │ ├── Features.tsx
│ │ │ │ │ └── index.ts
│ │ │ │ └── 06-footer/
│ │ │ │ ├── Footer.tsx
│ │ │ │ └── index.ts
│ │ │ ├── theme/
│ │ │ │ └── theme.tsx
│ │ │ └── ui/
│ │ │ ├── Badge/
│ │ │ │ ├── Badge.module.css
│ │ │ │ └── Badge.tsx
│ │ │ ├── Button/
│ │ │ │ ├── Button.module.css
│ │ │ │ └── Button.tsx
│ │ │ ├── Divider/
│ │ │ │ ├── Divider.module.css
│ │ │ │ └── Divider.tsx
│ │ │ └── Typography/
│ │ │ ├── Heading.module.css
│ │ │ ├── Heading.tsx
│ │ │ ├── Text.module.css
│ │ │ └── Text.tsx
│ │ ├── hooks/
│ │ │ ├── useSession.ts
│ │ │ └── useSessions.ts
│ │ ├── providers/
│ │ │ └── .gitkeep
│ │ ├── react-query/
│ │ │ └── query-client.ts
│ │ └── redux/
│ │ └── store.ts
│ ├── server/
│ │ ├── adapters/
│ │ │ ├── actions/
│ │ │ │ └── .gitkeep
│ │ │ ├── cron/
│ │ │ │ └── .gitkeep
│ │ │ ├── http/
│ │ │ │ ├── controllers/
│ │ │ │ │ └── .gitkeep
│ │ │ │ ├── middleware/
│ │ │ │ │ └── logger.ts
│ │ │ │ └── routes/
│ │ │ │ └── .gitkeep
│ │ │ └── websocket/
│ │ │ └── .gitkeep
│ │ ├── domain/
│ │ │ ├── session/
│ │ │ │ ├── session.services.ts
│ │ │ │ └── session.types.ts
│ │ │ └── user/
│ │ │ └── user.types.ts
│ │ └── infrastructure/
│ │ ├── ai/
│ │ │ └── .gitkeep
│ │ ├── auth/
│ │ │ ├── getUser.ts
│ │ │ └── requireUser.ts
│ │ ├── db/
│ │ │ ├── mongodb/
│ │ │ │ ├── client.ts
│ │ │ │ └── schema.prisma.ts
│ │ │ └── postgres/
│ │ │ ├── client.ts
│ │ │ ├── repositories/
│ │ │ │ ├── session.repo.ts
│ │ │ │ └── user.repo.ts
│ │ │ └── schema/
│ │ │ └── index.ts
│ │ └── external/
│ │ └── scratch.txt
│ └── shared/
│ ├── constants/
│ │ └── app.constants.ts
│ └── lib/
│ ├── errors/
│ │ └── AppError.ts
│ ├── utils/
│ │ ├── calculateScore.ts
│ │ └── formatDate.ts
│ └── validators/
│ ├── session.validator.ts
│ └── user.validator.ts
└── tsconfig.json

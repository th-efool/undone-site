# Directory Structure

./
├── .github/
│   └── workflows/
│       └── update-directory-structure.yml
├── ai-context/
│   ├── design-css-tokens.md
│   ├── directory-structure.md
│   └── hero-section-guidelines.md
├── public/
│   ├── icons/
│   │   ├── apple.webp
│   │   ├── github.webp
│   │   ├── google.webp
│   │   ├── screenshotquill.png
│   │   └── slack.webp
│   ├── images/
│   │   ├── auth/
│   │   │   ├── claude.webp
│   │   │   ├── faceless.webp
│   │   │   ├── maker.webp
│   │   │   └── phone.webp
│   │   ├── icons/
│   │   │   ├── 128/
│   │   │   │   ├── Ai.webp
│   │   │   │   ├── Article.webp
│   │   │   │   ├── Book.webp
│   │   │   │   ├── Bookmark.webp
│   │   │   │   ├── Calender.webp
│   │   │   │   ├── Headphone.webp
│   │   │   │   ├── Youtube.webp
│   │   │   │   └── floating-logo.webp
│   │   │   ├── 512/
│   │   │   │   ├── Ai.webp
│   │   │   │   ├── Article.webp
│   │   │   │   ├── Book.webp
│   │   │   │   ├── Bookmark.webp
│   │   │   │   ├── Calender.webp
│   │   │   │   ├── Headphone.webp
│   │   │   │   └── Youtube.webp
│   │   │   ├── coursera-white.webp
│   │   │   ├── coursera.webp
│   │   │   ├── icon-style-ref.png
│   │   │   ├── youtube-white.webp
│   │   │   └── youtube.webp
│   │   ├── landing/
│   │   │   ├── before-sleep.webp
│   │   │   ├── cab-ride.webp
│   │   │   ├── coffee-break.webp
│   │   │   ├── hand.webp
│   │   │   ├── metro-ride.webp
│   │   │   ├── phone.webp
│   │   │   ├── screen.webp
│   │   │   └── waiting.webp
│   │   ├── logos/
│   │   │   ├── floating-logo.png
│   │   │   ├── floating-logo.webp
│   │   │   └── sidequesthq-logo.webp
│   │   ├── footer-bg.jpeg
│   │   ├── footer-mascot.png
│   │   ├── hero-poster.webp
│   │   └── onlyMascot.png
│   ├── mock/
│   │   └── avatars/
│   │       ├── a.webp
│   │       ├── b.webp
│   │       ├── c.webp
│   │       ├── d.webp
│   │       └── e.webp
│   ├── mockups/
│   │   └── dashboard-microlearning.png
│   ├── videos/
│   │   ├── auth/
│   │   │   ├── 1.webm
│   │   │   ├── 2.webm
│   │   │   ├── 3.webm
│   │   │   ├── 4.webm
│   │   │   ├── 5.webm
│   │   │   ├── 6.webm
│   │   │   ├── 7.webm
│   │   │   ├── 8.webm
│   │   │   └── 9.webm
│   │   └── hero.webm
│   ├── file.svg
│   ├── globe.svg
│   └── window.svg
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── auth/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── explore/
│   │   │   │   └── page.tsx
│   │   │   ├── home/
│   │   │   │   └── page.tsx
│   │   │   ├── message/
│   │   │   │   └── page.tsx
│   │   │   ├── notes/
│   │   │   │   └── page.tsx
│   │   │   ├── play/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (landing)/
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   └── page.tsx
│   │   ├── styles/
│   │   │   ├── accessibility.css
│   │   │   ├── buttons.css
│   │   │   ├── forms.css
│   │   │   ├── layout.css
│   │   │   ├── print.css
│   │   │   ├── reset.css
│   │   │   ├── tokens.css
│   │   │   └── typography.css
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── client/
│   │   ├── components/
│   │   │   ├── global/
│   │   │   │   ├── DashboardShell/
│   │   │   │   │   ├── DashboardShell.module.css
│   │   │   │   │   └── DashboardShell.tsx
│   │   │   │   ├── Footer/
│   │   │   │   │   ├── Footer.module.css
│   │   │   │   │   └── Footer.tsx
│   │   │   │   ├── HorizontalScroller/
│   │   │   │   │   ├── HorizontalScroller.module.css
│   │   │   │   │   ├── HorizontalScroller.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── Logo/
│   │   │   │   │   ├── Logo.module.css
│   │   │   │   │   └── Logo.tsx
│   │   │   │   ├── Navbar/
│   │   │   │   │   ├── Navbar.module.css
│   │   │   │   │   └── Navbar.tsx
│   │   │   │   ├── ProviderBadge/
│   │   │   │   │   ├── ProviderBadge.module.css
│   │   │   │   │   ├── ProviderBadge.tsx
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── types.ts
│   │   │   │   ├── SearchBar/
│   │   │   │   │   ├── SearchBar.module.css
│   │   │   │   │   ├── SearchBar.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── Sidebar/
│   │   │   │   │   ├── Sidebar.module.css
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   ├── SidebarItem.module.css
│   │   │   │   │   ├── SidebarItem.tsx
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── sidebar.data.ts
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Cluster.tsx
│   │   │   │   │   ├── Container.tsx
│   │   │   │   │   ├── Layout.module.css
│   │   │   │   │   ├── Section.tsx
│   │   │   │   │   ├── SectionHeader.tsx
│   │   │   │   │   ├── Stack.tsx
│   │   │   │   │   ├── Surface.tsx
│   │   │   │   │   └── layoutTokens.ts
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── Logo.tsx
│   │   │   │   └── Navbar.tsx
│   │   │   ├── screens/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── authForm/
│   │   │   │   │   │   ├── authButton.module.css
│   │   │   │   │   │   ├── authButton.tsx
│   │   │   │   │   │   ├── authDivider.module.css
│   │   │   │   │   │   ├── authDivider.tsx
│   │   │   │   │   │   ├── authForm.module.css
│   │   │   │   │   │   ├── authForm.tsx
│   │   │   │   │   │   ├── authInput.module.css
│   │   │   │   │   │   ├── authInput.tsx
│   │   │   │   │   │   ├── authLegal.module.css
│   │   │   │   │   │   ├── authLegal.tsx
│   │   │   │   │   │   ├── authProviders.module.css
│   │   │   │   │   │   ├── authProviders.tsx
│   │   │   │   │   │   ├── authStats.module.css
│   │   │   │   │   │   └── authStats.tsx
│   │   │   │   │   ├── authShowcase/
│   │   │   │   │   │   ├── authCommunityGrid.module.css
│   │   │   │   │   │   ├── authCommunityGrid.tsx
│   │   │   │   │   │   ├── authData.ts
│   │   │   │   │   │   ├── authFeaturedContent.module.css
│   │   │   │   │   │   ├── authFeaturedContent.tsx
│   │   │   │   │   │   ├── authHighlights.module.css
│   │   │   │   │   │   ├── authHighlights.tsx
│   │   │   │   │   │   ├── authPhone.module.css
│   │   │   │   │   │   ├── authPhone.tsx
│   │   │   │   │   │   ├── authShowcase.module.css
│   │   │   │   │   │   └── authShowcase.tsx
│   │   │   │   │   ├── .gitkeep
│   │   │   │   │   ├── Auth.module.css
│   │   │   │   │   ├── Auth.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── explore/
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── BrowseTopics/
│   │   │   │   │   │   │   │   ├── BrowseTopics.module.css
│   │   │   │   │   │   │   │   ├── BrowseTopics.tsx
│   │   │   │   │   │   │   │   ├── TopicChip.module.css
│   │   │   │   │   │   │   │   └── TopicChip.tsx
│   │   │   │   │   │   │   ├── ContinueExploring/
│   │   │   │   │   │   │   │   ├── ContinueExploring.module.css
│   │   │   │   │   │   │   │   ├── ContinueExploring.tsx
│   │   │   │   │   │   │   │   ├── ContinueExploringCard.module.css
│   │   │   │   │   │   │   │   └── ContinueExploringCard.tsx
│   │   │   │   │   │   │   ├── ExploreHero/
│   │   │   │   │   │   │   │   ├── ExploreHero.module.css
│   │   │   │   │   │   │   │   └── ExploreHero.tsx
│   │   │   │   │   │   │   ├── PeopleFinishing/
│   │   │   │   │   │   │   │   ├── PeopleFinishing.module.css
│   │   │   │   │   │   │   │   ├── PeopleFinishing.tsx
│   │   │   │   │   │   │   │   ├── TrendingCourseCard.module.css
│   │   │   │   │   │   │   │   └── TrendingCourseCard.tsx
│   │   │   │   │   │   │   ├── RecentlyPublished/
│   │   │   │   │   │   │   │   ├── ArticleCard.module.css
│   │   │   │   │   │   │   │   ├── ArticleCard.tsx
│   │   │   │   │   │   │   │   ├── RecentlyPublished.module.css
│   │   │   │   │   │   │   │   └── RecentlyPublished.tsx
│   │   │   │   │   │   │   ├── SectionHeader/
│   │   │   │   │   │   │   │   ├── SectionHeader.module.css
│   │   │   │   │   │   │   │   └── SectionHeader.tsx
│   │   │   │   │   │   │   └── TrendingSideQuests/
│   │   │   │   │   │   │       ├── SideQuestCard.module.css
│   │   │   │   │   │   │       ├── SideQuestCard.tsx
│   │   │   │   │   │   │       ├── TrendingSideQuests.module.css
│   │   │   │   │   │   │       └── TrendingSideQuests.tsx
│   │   │   │   │   │   ├── hooks/
│   │   │   │   │   │   │   └── useExplore.ts
│   │   │   │   │   │   ├── mock/
│   │   │   │   │   │   │   └── explore.mock.ts
│   │   │   │   │   │   ├── models/
│   │   │   │   │   │   │   ├── articlePreview.ts
│   │   │   │   │   │   │   ├── continue-exploring.ts
│   │   │   │   │   │   │   ├── explore.ts
│   │   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   │   ├── search.ts
│   │   │   │   │   │   │   ├── sidequest.ts
│   │   │   │   │   │   │   ├── topic.ts
│   │   │   │   │   │   │   └── trending-course.ts
│   │   │   │   │   │   ├── utils/
│   │   │   │   │   │   │   └── scroll.ts
│   │   │   │   │   │   ├── Explore.module.css
│   │   │   │   │   │   ├── Explore.tsx
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── home/
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── ActiveCohortRow/
│   │   │   │   │   │   │   │   ├── ActiveCohortRow.module.css
│   │   │   │   │   │   │   │   └── ActiveCohortRow.tsx
│   │   │   │   │   │   │   ├── ActiveCohorts/
│   │   │   │   │   │   │   │   ├── ActiveCohorts.module.css
│   │   │   │   │   │   │   │   └── ActiveCohorts.tsx
│   │   │   │   │   │   │   ├── CompletedCourseCard/
│   │   │   │   │   │   │   │   ├── CompletedCourseCard.module.css
│   │   │   │   │   │   │   │   └── CompletedCourseCard.tsx
│   │   │   │   │   │   │   ├── ContinueLater/
│   │   │   │   │   │   │   │   ├── ContinueLater.module.css
│   │   │   │   │   │   │   │   └── ContinueLater.tsx
│   │   │   │   │   │   │   ├── ContinueLaterCard/
│   │   │   │   │   │   │   │   ├── ContinueLaterCard.module.css
│   │   │   │   │   │   │   │   └── ContinueLaterCard.tsx
│   │   │   │   │   │   │   ├── HomeHero/
│   │   │   │   │   │   │   │   ├── HomeHero.module.css
│   │   │   │   │   │   │   │   └── HomeHero.tsx
│   │   │   │   │   │   │   ├── RecentlyCompleted/
│   │   │   │   │   │   │   │   ├── RecentlyCompleted.module.css
│   │   │   │   │   │   │   │   └── RecentlyCompleted.tsx
│   │   │   │   │   │   │   ├── SectionHeader/
│   │   │   │   │   │   │   │   ├── SectionHeader.module.css
│   │   │   │   │   │   │   │   └── SectionHeader.tsx
│   │   │   │   │   │   │   └── SummaryCards/
│   │   │   │   │   │   │       ├── SummaryCards.module.css
│   │   │   │   │   │   │       └── SummaryCards.tsx
│   │   │   │   │   │   ├── hooks/
│   │   │   │   │   │   │   └── useHome.ts
│   │   │   │   │   │   ├── mock/
│   │   │   │   │   │   │   └── home.mock.tsx
│   │   │   │   │   │   ├── models/
│   │   │   │   │   │   │   ├── home.ts
│   │   │   │   │   │   │   └── index.ts
│   │   │   │   │   │   ├── utils/
│   │   │   │   │   │   │   ├── cohortManagement.ts
│   │   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   │   └── scroll.ts
│   │   │   │   │   │   ├── Home.module.css
│   │   │   │   │   │   ├── Home.tsx
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── message/
│   │   │   │   │   │   ├── Message.tsx
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── notes/
│   │   │   │   │   │   ├── Notes.tsx
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   └── play/
│   │   │   │   │       ├── components/
│   │   │   │   │       │   ├── LearningTimeline/
│   │   │   │   │       │   │   ├── LearningTimeline.module.css
│   │   │   │   │       │   │   └── LearningTimeline.tsx
│   │   │   │   │       │   ├── LessonCard/
│   │   │   │   │       │   │   ├── LessonCard.module.css
│   │   │   │   │       │   │   └── LessonCard.tsx
│   │   │   │   │       │   ├── PlaybackControls/
│   │   │   │   │       │   │   ├── PlaybackControls.module.css
│   │   │   │   │       │   │   ├── PlaybackControls.tsx
│   │   │   │   │       │   │   ├── VolumeControl.module.css
│   │   │   │   │       │   │   └── VolumeControl.tsx
│   │   │   │   │       │   ├── PlayerSurface/
│   │   │   │   │       │   │   ├── PlayerSurface.module.css
│   │   │   │   │       │   │   └── PlayerSurface.tsx
│   │   │   │   │       │   ├── PlayerToolbar/
│   │   │   │   │       │   │   ├── components/
│   │   │   │   │       │   │   │   ├── BookmarkButton.tsx
│   │   │   │   │       │   │   │   ├── CaptureButton.tsx
│   │   │   │   │       │   │   │   ├── PlaybackSpeed.tsx
│   │   │   │   │       │   │   │   ├── ScribeButton.tsx
│   │   │   │   │       │   │   │   ├── ToolbarMenu.tsx
│   │   │   │   │       │   │   │   └── index.ts
│   │   │   │   │       │   │   ├── PlayerToolbar.module.css
│   │   │   │   │       │   │   └── PlayerToolbar.tsx
│   │   │   │   │       │   └── index.ts
│   │   │   │   │       ├── hooks/
│   │   │   │   │       │   └── usePlayback.ts
│   │   │   │   │       ├── types/
│   │   │   │   │       │   ├── play.mock.ts
│   │   │   │   │       │   └── play.ts
│   │   │   │   │       ├── Play.module.css
│   │   │   │   │       ├── Play.tsx
│   │   │   │   │       └── index.ts
│   │   │   │   └── landing/
│   │   │   │       ├── 01-hero/
│   │   │   │       │   ├── Hero.module.css
│   │   │   │       │   ├── Hero.tsx
│   │   │   │       │   ├── heroContent.module.css
│   │   │   │       │   ├── heroContent.tsx
│   │   │   │       │   ├── heroFloatingContentIcons.module.css
│   │   │   │       │   ├── heroFloatingContentIcons.tsx
│   │   │   │       │   ├── heroNavbar.module.css
│   │   │   │       │   ├── heroNavbar.tsx
│   │   │   │       │   ├── heroScene.tsx
│   │   │   │       │   ├── heroTicker.module.css
│   │   │   │       │   ├── heroTicker.tsx
│   │   │   │       │   └── index.ts
│   │   │   │       ├── 02-ikigai/
│   │   │   │       │   ├── CalendarMonth/
│   │   │   │       │   │   ├── CalendarMonth.module.css
│   │   │   │       │   │   ├── CalendarMonth.tsx
│   │   │   │       │   │   ├── calendarData.ts
│   │   │   │       │   │   ├── calendarMonth.types.ts
│   │   │   │       │   │   ├── calendarTypes.ts
│   │   │   │       │   │   └── calendarUtils.ts
│   │   │   │       │   ├── FeatureSection.module.css
│   │   │   │       │   ├── FeatureSection.tsx
│   │   │   │       │   ├── Ikigai.tsx
│   │   │   │       │   ├── ProgressSection.module.css
│   │   │   │       │   ├── ProgressSection.tsx
│   │   │   │       │   ├── ikigaiTimeline.module.css
│   │   │   │       │   ├── ikigaiTimeline.tsx
│   │   │   │       │   ├── index.ts
│   │   │   │       │   ├── learningList.module.css
│   │   │   │       │   └── learningList.tsx
│   │   │   │       ├── 03-problem/
│   │   │   │       │   ├── Problem.tsx
│   │   │   │       │   └── index.ts
│   │   │   │       ├── 04-community/
│   │   │   │       │   ├── Community.tsx
│   │   │   │       │   └── index.ts
│   │   │   │       ├── 05-Features/
│   │   │   │       │   ├── Features.tsx
│   │   │   │       │   └── index.ts
│   │   │   │       ├── 06-footer/
│   │   │   │       │   ├── Footer.tsx
│   │   │   │       │   └── index.ts
│   │   │   │       └── .gitkeep
│   │   │   ├── theme/
│   │   │   │   └── theme.tsx
│   │   │   └── ui/
│   │   │       ├── Badge/
│   │   │       │   ├── Badge.module.css
│   │   │       │   └── Badge.tsx
│   │   │       ├── Button/
│   │   │       │   ├── Button.module.css
│   │   │       │   └── Button.tsx
│   │   │       ├── Divider/
│   │   │       │   ├── Divider.module.css
│   │   │       │   └── Divider.tsx
│   │   │       └── Typography/
│   │   │           ├── Heading.module.css
│   │   │           ├── Heading.tsx
│   │   │           ├── Text.module.css
│   │   │           └── Text.tsx
│   │   ├── hooks/
│   │   │   ├── useSession.ts
│   │   │   └── useSessions.ts
│   │   ├── providers/
│   │   │   └── .gitkeep
│   │   ├── react-query/
│   │   │   └── query-client.ts
│   │   └── redux/
│   │       └── store.ts
│   ├── server/
│   │   ├── adapters/
│   │   │   ├── actions/
│   │   │   │   └── .gitkeep
│   │   │   ├── cron/
│   │   │   │   └── .gitkeep
│   │   │   ├── http/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── .gitkeep
│   │   │   │   ├── middleware/
│   │   │   │   │   └── logger.ts
│   │   │   │   └── routes/
│   │   │   │       └── .gitkeep
│   │   │   └── websocket/
│   │   │       └── .gitkeep
│   │   ├── domain/
│   │   │   ├── session/
│   │   │   │   ├── session.services.ts
│   │   │   │   └── session.types.ts
│   │   │   └── user/
│   │   │       └── user.types.ts
│   │   └── infrastructure/
│   │       ├── ai/
│   │       │   └── .gitkeep
│   │       ├── auth/
│   │       │   ├── getUser.ts
│   │       │   └── requireUser.ts
│   │       ├── db/
│   │       │   ├── mongodb/
│   │       │   │   ├── client.ts
│   │       │   │   └── schema.prisma.ts
│   │       │   └── postgres/
│   │       │       ├── repositories/
│   │       │       │   ├── session.repo.ts
│   │       │       │   └── user.repo.ts
│   │       │       ├── schema/
│   │       │       │   └── index.ts
│   │       │       └── client.ts
│   │       └── external/
│   │           └── scratch.txt
│   └── shared/
│       ├── constants/
│       │   └── app.constants.ts
│       └── lib/
│           ├── errors/
│           │   └── AppError.ts
│           ├── utils/
│           │   ├── calculateScore.ts
│           │   └── formatDate.ts
│           └── validators/
│               ├── session.validator.ts
│               └── user.validator.ts
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── eslint.config.mjs
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
└── tsconfig.json

132 directories, 335 files

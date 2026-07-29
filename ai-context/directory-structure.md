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
│   │   ├── avatars/
│   │   │   ├── a.webp
│   │   │   ├── b.webp
│   │   │   ├── c.webp
│   │   │   ├── d.webp
│   │   │   └── e.webp
│   │   └── thumbnails/
│   │       ├── 100dcode.jpg
│   │       ├── civilization.jpeg
│   │       ├── content-bottle.webp
│   │       ├── data-science.avif
│   │       ├── data-storytelling.jpg
│   │       ├── deep-work-m.png
│   │       ├── deep-work.webp
│   │       ├── docker.avif
│   │       ├── doubling.webp
│   │       ├── german.webp
│   │       ├── history-psych.jpg
│   │       ├── japanese.webp
│   │       ├── javascript.jpeg
│   │       ├── machine-learning.avif
│   │       ├── philosophy.jpg
│   │       ├── react.webp
│   │       ├── reader.webp
│   │       ├── reading.webp
│   │       ├── reflections.jpeg
│   │       ├── space.jpeg
│   │       ├── system-design.jpeg
│   │       └── ui-fundamentals.webp
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
│   │   │   ├── cohort/
│   │   │   │   ├── [cohortId]/
│   │   │   │   │   ├── archives/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── events/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── hall-of-fame/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── overview/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── questline/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
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
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── PillInput.module.css
│   │   │   │   └── PillInput.tsx
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
│   │   │   │   ├── cohort/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── CohortHero/
│   │   │   │   │   │   │   ├── CohortHero.module.css
│   │   │   │   │   │   │   └── CohortHero.tsx
│   │   │   │   │   │   ├── CohortLayout/
│   │   │   │   │   │   │   ├── CohortLayout.module.css
│   │   │   │   │   │   │   └── CohortLayout.tsx
│   │   │   │   │   │   ├── CohortNavigation/
│   │   │   │   │   │   │   ├── CohortNavigation.module.css
│   │   │   │   │   │   │   └── CohortNavigation.tsx
│   │   │   │   │   │   └── ProgressSidebar/
│   │   │   │   │   │       ├── ProgressSidebar.module.css
│   │   │   │   │   │       └── ProgressSidebar.tsx
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   ├── useArchives.ts
│   │   │   │   │   │   ├── useCohort.ts
│   │   │   │   │   │   ├── useEvents.ts
│   │   │   │   │   │   └── useQuestline.ts
│   │   │   │   │   ├── mocks/
│   │   │   │   │   │   └── cohortMock.ts
│   │   │   │   │   ├── models/
│   │   │   │   │   │   ├── archives.ts
│   │   │   │   │   │   ├── cohort.ts
│   │   │   │   │   │   ├── events.ts
│   │   │   │   │   │   ├── hallOfFame.ts
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   ├── navigation.ts
│   │   │   │   │   │   └── questline.ts
│   │   │   │   │   ├── tabs/
│   │   │   │   │   │   ├── archives/
│   │   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   │   ├── ArchiveCard/
│   │   │   │   │   │   │   │   │   └── ArchiveCard.tsx
│   │   │   │   │   │   │   │   ├── ArchiveFeed/
│   │   │   │   │   │   │   │   │   └── ArchiveFeed.tsx
│   │   │   │   │   │   │   │   ├── ArchiveFilters/
│   │   │   │   │   │   │   │   │   └── ArchiveFilters.tsx
│   │   │   │   │   │   │   │   ├── ArchiveSearch/
│   │   │   │   │   │   │   │   │   └── ArchiveSearch.tsx
│   │   │   │   │   │   │   │   ├── ArchiveThumbnail/
│   │   │   │   │   │   │   │   │   └── ArchiveThumbnail.tsx
│   │   │   │   │   │   │   │   ├── ArchiveTypeBadge/
│   │   │   │   │   │   │   │   │   └── ArchiveTypeBadge.tsx
│   │   │   │   │   │   │   │   ├── ArchiveVoting/
│   │   │   │   │   │   │   │   │   └── ArchiveVoting.tsx
│   │   │   │   │   │   │   │   ├── ArchivesHeader/
│   │   │   │   │   │   │   │   │   └── ArchivesHeader.tsx
│   │   │   │   │   │   │   │   ├── ArchivesPage/
│   │   │   │   │   │   │   │   │   └── ArchivesPage.tsx
│   │   │   │   │   │   │   │   ├── ArchivesSidebar/
│   │   │   │   │   │   │   │   │   └── ArchivesSidebar.tsx
│   │   │   │   │   │   │   │   ├── ContributorsCard/
│   │   │   │   │   │   │   │   │   └── ContributorsCard.tsx
│   │   │   │   │   │   │   │   ├── ShareKnowledgeCard/
│   │   │   │   │   │   │   │   │   └── ShareKnowledgeCard.tsx
│   │   │   │   │   │   │   │   ├── SideCard/
│   │   │   │   │   │   │   │   │   └── SideCard.tsx
│   │   │   │   │   │   │   │   ├── SortingControls/
│   │   │   │   │   │   │   │   │   └── SortingControls.tsx
│   │   │   │   │   │   │   │   └── TrendingCard/
│   │   │   │   │   │   │   │       └── TrendingCard.tsx
│   │   │   │   │   │   │   ├── Archives.module.css
│   │   │   │   │   │   │   └── Archives.tsx
│   │   │   │   │   │   ├── events/
│   │   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   │   ├── CalendarSync/
│   │   │   │   │   │   │   │   │   └── CalendarSync.tsx
│   │   │   │   │   │   │   │   ├── Card/
│   │   │   │   │   │   │   │   │   └── Card.tsx
│   │   │   │   │   │   │   │   ├── EventActions/
│   │   │   │   │   │   │   │   │   └── EventActions.tsx
│   │   │   │   │   │   │   │   ├── EventAttendance/
│   │   │   │   │   │   │   │   │   └── EventAttendance.tsx
│   │   │   │   │   │   │   │   ├── EventCard/
│   │   │   │   │   │   │   │   │   └── EventCard.tsx
│   │   │   │   │   │   │   │   ├── EventDateCard/
│   │   │   │   │   │   │   │   │   └── EventDateCard.tsx
│   │   │   │   │   │   │   │   ├── EventList/
│   │   │   │   │   │   │   │   │   └── EventList.tsx
│   │   │   │   │   │   │   │   ├── EventStatusBadge/
│   │   │   │   │   │   │   │   │   └── EventStatusBadge.tsx
│   │   │   │   │   │   │   │   ├── EventsFilters/
│   │   │   │   │   │   │   │   │   └── EventsFilters.tsx
│   │   │   │   │   │   │   │   ├── EventsHeader/
│   │   │   │   │   │   │   │   │   └── EventsHeader.tsx
│   │   │   │   │   │   │   │   ├── EventsPage/
│   │   │   │   │   │   │   │   │   └── EventsPage.tsx
│   │   │   │   │   │   │   │   ├── EventsSidebar/
│   │   │   │   │   │   │   │   │   └── EventsSidebar.tsx
│   │   │   │   │   │   │   │   ├── RSVPButton/
│   │   │   │   │   │   │   │   │   └── RSVPButton.tsx
│   │   │   │   │   │   │   │   ├── SuggestEvent/
│   │   │   │   │   │   │   │   │   └── SuggestEvent.tsx
│   │   │   │   │   │   │   │   └── ThisWeek/
│   │   │   │   │   │   │   │       └── ThisWeek.tsx
│   │   │   │   │   │   │   ├── Events.module.css
│   │   │   │   │   │   │   └── Events.tsx
│   │   │   │   │   │   ├── hallOfFame/
│   │   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   │   ├── AchievementBadge/
│   │   │   │   │   │   │   │   │   └── AchievementBadge.tsx
│   │   │   │   │   │   │   │   ├── AchievementRow/
│   │   │   │   │   │   │   │   │   └── AchievementRow.tsx
│   │   │   │   │   │   │   │   ├── AchievementsCard/
│   │   │   │   │   │   │   │   │   └── AchievementsCard.tsx
│   │   │   │   │   │   │   │   ├── CategoryFilter/
│   │   │   │   │   │   │   │   │   └── CategoryFilter.tsx
│   │   │   │   │   │   │   │   ├── CategoryFilters/
│   │   │   │   │   │   │   │   │   └── CategoryFilters.tsx
│   │   │   │   │   │   │   │   ├── HallOfFameHeader/
│   │   │   │   │   │   │   │   │   └── HallOfFameHeader.tsx
│   │   │   │   │   │   │   │   ├── HallOfFamePage/
│   │   │   │   │   │   │   │   │   └── HallOfFamePage.tsx
│   │   │   │   │   │   │   │   ├── HallOfLegends/
│   │   │   │   │   │   │   │   │   └── HallOfLegends.tsx
│   │   │   │   │   │   │   │   ├── HallSidebar/
│   │   │   │   │   │   │   │   │   └── HallSidebar.tsx
│   │   │   │   │   │   │   │   ├── HighlightRow/
│   │   │   │   │   │   │   │   │   └── HighlightRow.tsx
│   │   │   │   │   │   │   │   ├── HighlightsCard/
│   │   │   │   │   │   │   │   │   └── HighlightsCard.tsx
│   │   │   │   │   │   │   │   ├── LeaderboardCard/
│   │   │   │   │   │   │   │   │   └── LeaderboardCard.tsx
│   │   │   │   │   │   │   │   ├── LeaderboardGrid/
│   │   │   │   │   │   │   │   │   └── LeaderboardGrid.tsx
│   │   │   │   │   │   │   │   ├── LegendsRow/
│   │   │   │   │   │   │   │   │   └── LegendsRow.tsx
│   │   │   │   │   │   │   │   ├── MedalIcon/
│   │   │   │   │   │   │   │   │   └── MedalIcon.tsx
│   │   │   │   │   │   │   │   ├── MetricBadge/
│   │   │   │   │   │   │   │   │   └── MetricBadge.tsx
│   │   │   │   │   │   │   │   ├── SideCard/
│   │   │   │   │   │   │   │   │   └── SideCard.tsx
│   │   │   │   │   │   │   │   └── TimeRangeDropdown/
│   │   │   │   │   │   │   │       └── TimeRangeDropdown.tsx
│   │   │   │   │   │   │   ├── HallOfFame.module.css
│   │   │   │   │   │   │   └── HallOfFame.tsx
│   │   │   │   │   │   ├── overview/
│   │   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   │   ├── AboutSection/
│   │   │   │   │   │   │   │   │   ├── AboutSection.module.css
│   │   │   │   │   │   │   │   │   └── AboutSection.tsx
│   │   │   │   │   │   │   │   ├── ExpeditionProgressCard/
│   │   │   │   │   │   │   │   │   ├── ExpeditionProgressCard.module.css
│   │   │   │   │   │   │   │   │   └── ExpeditionProgressCard.tsx
│   │   │   │   │   │   │   │   ├── ExpeditionStatsCard/
│   │   │   │   │   │   │   │   │   ├── ExpeditionStatsCard.module.css
│   │   │   │   │   │   │   │   │   └── ExpeditionStatsCard.tsx
│   │   │   │   │   │   │   │   ├── JourneySummary/
│   │   │   │   │   │   │   │   │   ├── JourneySummary.module.css
│   │   │   │   │   │   │   │   │   └── JourneySummary.tsx
│   │   │   │   │   │   │   │   ├── LearningChecklist/
│   │   │   │   │   │   │   │   │   ├── LearningChecklist.module.css
│   │   │   │   │   │   │   │   │   └── LearningChecklist.tsx
│   │   │   │   │   │   │   │   ├── LearningPillars/
│   │   │   │   │   │   │   │   │   ├── LearningPillars.module.css
│   │   │   │   │   │   │   │   │   └── LearningPillars.tsx
│   │   │   │   │   │   │   │   ├── OverviewIcon/
│   │   │   │   │   │   │   │   │   └── OverviewIcon.tsx
│   │   │   │   │   │   │   │   └── QuestGuideCard/
│   │   │   │   │   │   │   │       ├── QuestGuideCard.module.css
│   │   │   │   │   │   │   │       └── QuestGuideCard.tsx
│   │   │   │   │   │   │   ├── Overview.module.css
│   │   │   │   │   │   │   └── Overview.tsx
│   │   │   │   │   │   └── questline/
│   │   │   │   │   │       ├── components/
│   │   │   │   │   │       │   ├── AssignmentsProjectsFeed/
│   │   │   │   │   │       │   │   ├── AssignmentsProjectsFeed.module.css
│   │   │   │   │   │       │   │   └── AssignmentsProjectsFeed.tsx
│   │   │   │   │   │       │   ├── FeedCard/
│   │   │   │   │   │       │   │   ├── FeedCard.module.css
│   │   │   │   │   │       │   │   └── FeedCard.tsx
│   │   │   │   │   │       │   ├── LessonList/
│   │   │   │   │   │       │   │   ├── LessonList.module.css
│   │   │   │   │   │       │   │   └── LessonList.tsx
│   │   │   │   │   │       │   ├── LessonRow/
│   │   │   │   │   │       │   │   ├── LessonRow.module.css
│   │   │   │   │   │       │   │   └── LessonRow.tsx
│   │   │   │   │   │       │   ├── LessonStatusBadge/
│   │   │   │   │   │       │   │   ├── LessonStatusBadge.module.css
│   │   │   │   │   │       │   │   └── LessonStatusBadge.tsx
│   │   │   │   │   │       │   ├── LessonTypeBadge/
│   │   │   │   │   │       │   │   ├── LessonTypeBadge.module.css
│   │   │   │   │   │       │   │   └── LessonTypeBadge.tsx
│   │   │   │   │   │       │   ├── LockedFutureNotice/
│   │   │   │   │   │       │   │   ├── LockedFutureNotice.module.css
│   │   │   │   │   │       │   │   └── LockedFutureNotice.tsx
│   │   │   │   │   │       │   ├── QuestlineFilters/
│   │   │   │   │   │       │   │   ├── QuestlineFilters.module.css
│   │   │   │   │   │       │   │   └── QuestlineFilters.tsx
│   │   │   │   │   │       │   ├── QuestlineIcon/
│   │   │   │   │   │       │   │   └── QuestlineIcon.tsx
│   │   │   │   │   │       │   ├── SeasonCard/
│   │   │   │   │   │       │   │   ├── SeasonCard.module.css
│   │   │   │   │   │       │   │   └── SeasonCard.tsx
│   │   │   │   │   │       │   ├── SeasonSummary/
│   │   │   │   │   │       │   │   ├── SeasonSummary.module.css
│   │   │   │   │   │       │   │   └── SeasonSummary.tsx
│   │   │   │   │   │       │   ├── SeasonTimeline/
│   │   │   │   │   │       │   │   ├── SeasonTimeline.module.css
│   │   │   │   │   │       │   │   └── SeasonTimeline.tsx
│   │   │   │   │   │       │   └── SkipSeasonDropdown/
│   │   │   │   │   │       │       ├── SkipSeasonDropdown.module.css
│   │   │   │   │   │       │       └── SkipSeasonDropdown.tsx
│   │   │   │   │   │       ├── Questline.module.css
│   │   │   │   │   │       └── Questline.tsx
│   │   │   │   │   ├── Cohort.module.css
│   │   │   │   │   ├── Cohort.tsx
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
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── Center/
│   │   │   │   │   │   │   │   ├── LiveCard/
│   │   │   │   │   │   │   │   │   ├── LiveCard.module.css
│   │   │   │   │   │   │   │   │   └── LiveCard.tsx
│   │   │   │   │   │   │   │   ├── LiveNow/
│   │   │   │   │   │   │   │   │   ├── LiveNow.module.css
│   │   │   │   │   │   │   │   │   └── LiveNow.tsx
│   │   │   │   │   │   │   │   ├── RecentMessageItem/
│   │   │   │   │   │   │   │   │   ├── RecentMessageItem.module.css
│   │   │   │   │   │   │   │   │   └── RecentMessageItem.tsx
│   │   │   │   │   │   │   │   ├── RecentMessages/
│   │   │   │   │   │   │   │   │   ├── RecentMessages.module.css
│   │   │   │   │   │   │   │   │   └── RecentMessages.tsx
│   │   │   │   │   │   │   │   ├── SearchHeader/
│   │   │   │   │   │   │   │   │   ├── SearchHeader.module.css
│   │   │   │   │   │   │   │   │   └── SearchHeader.tsx
│   │   │   │   │   │   │   │   ├── Center.module.css
│   │   │   │   │   │   │   │   └── Center.tsx
│   │   │   │   │   │   │   ├── CommunityChat/
│   │   │   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   │   │   ├── ChannelTabs/
│   │   │   │   │   │   │   │   │   │   ├── ChannelTabs.module.css
│   │   │   │   │   │   │   │   │   │   └── ChannelTabs.tsx
│   │   │   │   │   │   │   │   │   ├── CommunityHeader/
│   │   │   │   │   │   │   │   │   │   ├── CommunityHeader.module.css
│   │   │   │   │   │   │   │   │   │   └── CommunityHeader.tsx
│   │   │   │   │   │   │   │   │   ├── CommunitySidebar/
│   │   │   │   │   │   │   │   │   │   ├── CommunitySidebar.module.css
│   │   │   │   │   │   │   │   │   │   └── CommunitySidebar.tsx
│   │   │   │   │   │   │   │   │   ├── MediaGallery/
│   │   │   │   │   │   │   │   │   │   ├── MediaGallery.module.css
│   │   │   │   │   │   │   │   │   │   └── MediaGallery.tsx
│   │   │   │   │   │   │   │   │   ├── MembersStrip/
│   │   │   │   │   │   │   │   │   │   ├── MembersStrip.module.css
│   │   │   │   │   │   │   │   │   │   └── MembersStrip.tsx
│   │   │   │   │   │   │   │   │   ├── MessageAttachment/
│   │   │   │   │   │   │   │   │   │   ├── MessageAttachment.module.css
│   │   │   │   │   │   │   │   │   │   └── MessageAttachment.tsx
│   │   │   │   │   │   │   │   │   ├── MessageBubble/
│   │   │   │   │   │   │   │   │   │   ├── MessageBubble.module.css
│   │   │   │   │   │   │   │   │   │   └── MessageBubble.tsx
│   │   │   │   │   │   │   │   │   ├── MessageComposer/
│   │   │   │   │   │   │   │   │   │   ├── MessageComposer.module.css
│   │   │   │   │   │   │   │   │   │   └── MessageComposer.tsx
│   │   │   │   │   │   │   │   │   ├── MessageTimeline/
│   │   │   │   │   │   │   │   │   │   ├── MessageTimeline.module.css
│   │   │   │   │   │   │   │   │   │   └── MessageTimeline.tsx
│   │   │   │   │   │   │   │   │   ├── PinnedBanner/
│   │   │   │   │   │   │   │   │   │   ├── PinnedBanner.module.css
│   │   │   │   │   │   │   │   │   │   └── PinnedBanner.tsx
│   │   │   │   │   │   │   │   │   ├── PinnedMessages/
│   │   │   │   │   │   │   │   │   │   ├── PinnedMessages.module.css
│   │   │   │   │   │   │   │   │   │   └── PinnedMessages.tsx
│   │   │   │   │   │   │   │   │   ├── ReactionBar/
│   │   │   │   │   │   │   │   │   │   ├── ReactionBar.module.css
│   │   │   │   │   │   │   │   │   │   └── ReactionBar.tsx
│   │   │   │   │   │   │   │   │   ├── ReplyPreview/
│   │   │   │   │   │   │   │   │   │   ├── ReplyPreview.module.css
│   │   │   │   │   │   │   │   │   │   └── ReplyPreview.tsx
│   │   │   │   │   │   │   │   │   └── UpcomingEvents/
│   │   │   │   │   │   │   │   │       ├── UpcomingEvents.module.css
│   │   │   │   │   │   │   │   │       └── UpcomingEvents.tsx
│   │   │   │   │   │   │   │   ├── CommunityChat.module.css
│   │   │   │   │   │   │   │   └── CommunityChat.tsx
│   │   │   │   │   │   │   ├── DMConversation/
│   │   │   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   │   │   ├── AboutCard/
│   │   │   │   │   │   │   │   │   │   ├── AboutCard.module.css
│   │   │   │   │   │   │   │   │   │   └── AboutCard.tsx
│   │   │   │   │   │   │   │   │   ├── DMBubble/
│   │   │   │   │   │   │   │   │   │   ├── DMBubble.module.css
│   │   │   │   │   │   │   │   │   │   └── DMBubble.tsx
│   │   │   │   │   │   │   │   │   ├── DMComposer/
│   │   │   │   │   │   │   │   │   │   ├── DMComposer.module.css
│   │   │   │   │   │   │   │   │   │   └── DMComposer.tsx
│   │   │   │   │   │   │   │   │   ├── DMHeader/
│   │   │   │   │   │   │   │   │   │   ├── DMHeader.module.css
│   │   │   │   │   │   │   │   │   │   └── DMHeader.tsx
│   │   │   │   │   │   │   │   │   ├── DMProfileSidebar/
│   │   │   │   │   │   │   │   │   │   ├── DMProfileSidebar.module.css
│   │   │   │   │   │   │   │   │   │   └── DMProfileSidebar.tsx
│   │   │   │   │   │   │   │   │   ├── DateDivider/
│   │   │   │   │   │   │   │   │   │   ├── DateDivider.module.css
│   │   │   │   │   │   │   │   │   │   └── DateDivider.tsx
│   │   │   │   │   │   │   │   │   ├── MessageReaction/
│   │   │   │   │   │   │   │   │   │   ├── MessageReaction.module.css
│   │   │   │   │   │   │   │   │   │   └── MessageReaction.tsx
│   │   │   │   │   │   │   │   │   ├── MessageStatus/
│   │   │   │   │   │   │   │   │   │   ├── MessageStatus.module.css
│   │   │   │   │   │   │   │   │   │   └── MessageStatus.tsx
│   │   │   │   │   │   │   │   │   ├── MessageTimeline/
│   │   │   │   │   │   │   │   │   │   ├── MessageTimeline.module.css
│   │   │   │   │   │   │   │   │   │   └── MessageTimeline.tsx
│   │   │   │   │   │   │   │   │   ├── NotificationCard/
│   │   │   │   │   │   │   │   │   │   ├── NotificationCard.module.css
│   │   │   │   │   │   │   │   │   │   └── NotificationCard.tsx
│   │   │   │   │   │   │   │   │   ├── QuickActions/
│   │   │   │   │   │   │   │   │   │   ├── QuickActions.module.css
│   │   │   │   │   │   │   │   │   │   └── QuickActions.tsx
│   │   │   │   │   │   │   │   │   ├── ResourceList/
│   │   │   │   │   │   │   │   │   │   ├── ResourceList.module.css
│   │   │   │   │   │   │   │   │   │   └── ResourceList.tsx
│   │   │   │   │   │   │   │   │   └── UserHero/
│   │   │   │   │   │   │   │   │       ├── UserHero.module.css
│   │   │   │   │   │   │   │   │       └── UserHero.tsx
│   │   │   │   │   │   │   │   ├── DMConversation.module.css
│   │   │   │   │   │   │   │   └── DMConversation.tsx
│   │   │   │   │   │   │   ├── LeftSidebar/
│   │   │   │   │   │   │   │   ├── ConversationItem/
│   │   │   │   │   │   │   │   │   ├── ConversationItem.module.css
│   │   │   │   │   │   │   │   │   └── ConversationItem.tsx
│   │   │   │   │   │   │   │   ├── ConversationList/
│   │   │   │   │   │   │   │   │   ├── ConversationList.module.css
│   │   │   │   │   │   │   │   │   └── ConversationList.tsx
│   │   │   │   │   │   │   │   ├── SidebarFilters/
│   │   │   │   │   │   │   │   │   ├── SidebarFilters.module.css
│   │   │   │   │   │   │   │   │   └── SidebarFilters.tsx
│   │   │   │   │   │   │   │   ├── SidebarHeader/
│   │   │   │   │   │   │   │   │   ├── SidebarHeader.module.css
│   │   │   │   │   │   │   │   │   └── SidebarHeader.tsx
│   │   │   │   │   │   │   │   ├── LeftSidebar.module.css
│   │   │   │   │   │   │   │   └── LeftSidebar.tsx
│   │   │   │   │   │   │   ├── MessageComposer/
│   │   │   │   │   │   │   │   ├── composers/
│   │   │   │   │   │   │   │   │   ├── CommunityComposer.tsx
│   │   │   │   │   │   │   │   │   ├── DMComposer.module.css
│   │   │   │   │   │   │   │   │   └── DMComposer.tsx
│   │   │   │   │   │   │   │   ├── MessageComposer.module.css
│   │   │   │   │   │   │   │   └── MessageComposer.tsx
│   │   │   │   │   │   │   ├── RightSidebar/
│   │   │   │   │   │   │   │   ├── DailyChallenge/
│   │   │   │   │   │   │   │   │   ├── DailyChallenge.module.css
│   │   │   │   │   │   │   │   │   └── DailyChallenge.tsx
│   │   │   │   │   │   │   │   ├── FriendAvatarGroup/
│   │   │   │   │   │   │   │   │   ├── FriendAvatarGroup.module.css
│   │   │   │   │   │   │   │   │   └── FriendAvatarGroup.tsx
│   │   │   │   │   │   │   │   ├── FriendsOnline/
│   │   │   │   │   │   │   │   │   ├── FriendsOnline.module.css
│   │   │   │   │   │   │   │   │   └── FriendsOnline.tsx
│   │   │   │   │   │   │   │   ├── UpcomingCard/
│   │   │   │   │   │   │   │   │   ├── UpcomingCard.module.css
│   │   │   │   │   │   │   │   │   └── UpcomingCard.tsx
│   │   │   │   │   │   │   │   ├── UpcomingEvents/
│   │   │   │   │   │   │   │   │   ├── UpcomingEvents.module.css
│   │   │   │   │   │   │   │   │   └── UpcomingEvents.tsx
│   │   │   │   │   │   │   │   ├── RightSidebar.module.css
│   │   │   │   │   │   │   │   └── RightSidebar.tsx
│   │   │   │   │   │   │   ├── SocialLanding/
│   │   │   │   │   │   │   │   ├── SocialLanding.module.css
│   │   │   │   │   │   │   │   └── SocialLanding.tsx
│   │   │   │   │   │   │   └── shared/
│   │   │   │   │   │   │       ├── EmptyState/
│   │   │   │   │   │   │       │   ├── EmptyState.module.css
│   │   │   │   │   │   │       │   ├── EmptyState.tsx
│   │   │   │   │   │   │       │   └── index.ts
│   │   │   │   │   │   │       ├── Skeleton/
│   │   │   │   │   │   │       │   ├── Skeleton.module.css
│   │   │   │   │   │   │       │   ├── Skeleton.tsx
│   │   │   │   │   │   │       │   └── index.ts
│   │   │   │   │   │   │       └── index.ts
│   │   │   │   │   │   ├── constants/
│   │   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   │   └── message.constants.ts
│   │   │   │   │   │   ├── hooks/
│   │   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   │   ├── useCommunity.ts
│   │   │   │   │   │   │   └── useMessage.ts
│   │   │   │   │   │   ├── mock/
│   │   │   │   │   │   │   ├── communityChat.mock.ts
│   │   │   │   │   │   │   ├── dmConversation.mock.ts
│   │   │   │   │   │   │   └── message.mock.ts
│   │   │   │   │   │   ├── models/
│   │   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   │   └── message.ts
│   │   │   │   │   │   ├── types/
│   │   │   │   │   │   │   └── index.ts
│   │   │   │   │   │   ├── utils/
│   │   │   │   │   │   │   ├── communityMapping.ts
│   │   │   │   │   │   │   └── index.ts
│   │   │   │   │   │   ├── Message.module.css
│   │   │   │   │   │   ├── Message.tsx
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── notes/
│   │   │   │   │   │   ├── adapters/
│   │   │   │   │   │   │   └── notes.adapter.ts
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   └── NotesComponents.tsx
│   │   │   │   │   │   ├── hooks/
│   │   │   │   │   │   │   └── useNotes.ts
│   │   │   │   │   │   ├── mock/
│   │   │   │   │   │   │   └── notes.seed.ts
│   │   │   │   │   │   ├── models/
│   │   │   │   │   │   │   └── notes.models.ts
│   │   │   │   │   │   ├── repositories/
│   │   │   │   │   │   │   └── notes.repository.ts
│   │   │   │   │   │   ├── Notes.module.css
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
│   │   ├── mock/
│   │   │   └── cohorts/
│   │   │       └── cohortCatalog.ts
│   │   ├── navigation/
│   │   │   └── cohortLinks.ts
│   │   ├── providers/
│   │   │   └── .gitkeep
│   │   ├── react-query/
│   │   │   └── query-client.ts
│   │   ├── redux/
│   │   │   └── store.ts
│   │   └── repositories/
│   │       ├── cohortRepository.ts
│   │       ├── exploreRepository.ts
│   │       ├── homeRepository.ts
│   │       └── messagesRepository.ts
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

299 directories, 621 files

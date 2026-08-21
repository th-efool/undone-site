# Directory Structure

./
├── .agents/
│   └── skills/
│       ├── prisma-cli/
│       │   ├── references/
│       │   │   ├── agent-safety.md
│       │   │   ├── complete.md
│       │   │   ├── db-execute.md
│       │   │   ├── db-pull.md
│       │   │   ├── db-push.md
│       │   │   ├── db-seed.md
│       │   │   ├── debug.md
│       │   │   ├── dev.md
│       │   │   ├── format.md
│       │   │   ├── generate.md
│       │   │   ├── init.md
│       │   │   ├── mcp.md
│       │   │   ├── migrate-deploy.md
│       │   │   ├── migrate-dev.md
│       │   │   ├── migrate-diff.md
│       │   │   ├── migrate-reset.md
│       │   │   ├── migrate-resolve.md
│       │   │   ├── migrate-status.md
│       │   │   ├── studio.md
│       │   │   └── validate.md
│       │   └── SKILL.md
│       ├── prisma-client-api/
│       │   ├── references/
│       │   │   ├── client-methods.md
│       │   │   ├── constructor.md
│       │   │   ├── filters.md
│       │   │   ├── model-queries.md
│       │   │   ├── query-options.md
│       │   │   ├── raw-queries.md
│       │   │   ├── relations.md
│       │   │   └── transactions.md
│       │   └── SKILL.md
│       ├── prisma-compute/
│       │   ├── references/
│       │   │   ├── app-deploy-cli.md
│       │   │   ├── compute-config.md
│       │   │   ├── create-prisma.md
│       │   │   ├── frameworks.md
│       │   │   ├── sdk-api.md
│       │   │   └── troubleshooting.md
│       │   └── SKILL.md
│       ├── prisma-database-setup/
│       │   ├── references/
│       │   │   ├── cockroachdb.md
│       │   │   ├── mongodb.md
│       │   │   ├── mysql.md
│       │   │   ├── postgresql.md
│       │   │   ├── prisma-client-setup.md
│       │   │   ├── prisma-postgres.md
│       │   │   ├── sqlite.md
│       │   │   └── sqlserver.md
│       │   └── SKILL.md
│       ├── prisma-driver-adapter-implementation/
│       │   └── SKILL.md
│       ├── prisma-mongodb-upgrade/
│       │   ├── references/
│       │   │   ├── client-api-mapping.md
│       │   │   ├── decision-stay-or-migrate.md
│       │   │   ├── migrations-mapping.md
│       │   │   ├── schema-contract-mapping.md
│       │   │   └── verify-cutover-checklist.md
│       │   └── SKILL.md
│       ├── prisma-postgres/
│       │   ├── references/
│       │   │   ├── console-and-connections.md
│       │   │   ├── create-db-cli.md
│       │   │   ├── management-api-sdk.md
│       │   │   └── management-api.md
│       │   └── SKILL.md
│       ├── prisma-postgres-setup/
│       │   ├── references/
│       │   │   ├── api-basics.md
│       │   │   ├── auth.md
│       │   │   ├── endpoints.md
│       │   │   └── prisma7-client.md
│       │   └── SKILL.md
│       └── prisma-upgrade-v7/
│           ├── references/
│           │   ├── accelerate-users.md
│           │   ├── driver-adapters.md
│           │   ├── env-variables.md
│           │   ├── esm-support.md
│           │   ├── prisma-config.md
│           │   ├── removed-features.md
│           │   └── schema-changes.md
│           └── SKILL.md
├── .github/
│   └── workflows/
│       └── update-directory-structure.yml
├── ai-context/
│   ├── fun-project/
│   │   ├── LICENSE
│   │   ├── index.html
│   │   ├── script.js
│   │   └── styles.css
│   ├── me temp/
│   │   ├── phase_2_auth.md
│   │   ├── phase_3_courses_cohorts.md
│   │   ├── phase_4_5_mongodb_workspace.md
│   │   └── phase_6_migration_pattern.md
│   ├── LOGO-no-book-compass.svg
│   ├── LOGO-recolored-floating.svg
│   ├── LOGO-recolored.svg
│   ├── LOGO-recolored1.svg
│   ├── UX_IMPROVEMENT_AUDIT.md
│   ├── UX_PHASED_IMPLEMENTATION_PLAN.md
│   ├── design-css-tokens.md
│   └── directory-structure.md
├── android/
│   ├── app/
│   │   ├── src/
│   │   │   ├── androidTest/
│   │   │   │   └── java/
│   │   │   │       └── com/
│   │   │   │           └── getcapacitor/
│   │   │   │               └── myapp/
│   │   │   │                   └── ExampleInstrumentedTest.java
│   │   │   ├── main/
│   │   │   │   ├── java/
│   │   │   │   │   └── com/
│   │   │   │   │       └── sidequesthq/
│   │   │   │   │           └── in/
│   │   │   │   │               └── MainActivity.java
│   │   │   │   ├── res/
│   │   │   │   │   ├── drawable/
│   │   │   │   │   │   ├── ic_launcher_background.xml
│   │   │   │   │   │   ├── ic_launcher_foreground.xml
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-hdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-ldpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-mdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-night-hdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-night-ldpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-night-mdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-night-xhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-night-xxhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-night-xxxhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-xhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-xxhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-land-xxxhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-night/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-hdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-ldpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-mdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-night-hdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-night-ldpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-night-mdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-night-xhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-night-xxhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-night-xxxhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-xhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-xxhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-port-xxxhdpi/
│   │   │   │   │   │   └── splash.png
│   │   │   │   │   ├── drawable-v24/
│   │   │   │   │   │   └── ic_launcher_foreground.xml
│   │   │   │   │   ├── layout/
│   │   │   │   │   │   └── activity_main.xml
│   │   │   │   │   ├── mipmap-anydpi-v26/
│   │   │   │   │   │   ├── ic_launcher.xml
│   │   │   │   │   │   └── ic_launcher_round.xml
│   │   │   │   │   ├── mipmap-hdpi/
│   │   │   │   │   │   ├── ic_launcher.png
│   │   │   │   │   │   ├── ic_launcher_background.png
│   │   │   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   │   │   └── ic_launcher_round.png
│   │   │   │   │   ├── mipmap-ldpi/
│   │   │   │   │   │   ├── ic_launcher.png
│   │   │   │   │   │   ├── ic_launcher_background.png
│   │   │   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   │   │   └── ic_launcher_round.png
│   │   │   │   │   ├── mipmap-mdpi/
│   │   │   │   │   │   ├── ic_launcher.png
│   │   │   │   │   │   ├── ic_launcher_background.png
│   │   │   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   │   │   └── ic_launcher_round.png
│   │   │   │   │   ├── mipmap-xhdpi/
│   │   │   │   │   │   ├── ic_launcher.png
│   │   │   │   │   │   ├── ic_launcher_background.png
│   │   │   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   │   │   └── ic_launcher_round.png
│   │   │   │   │   ├── mipmap-xxhdpi/
│   │   │   │   │   │   ├── ic_launcher.png
│   │   │   │   │   │   ├── ic_launcher_background.png
│   │   │   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   │   │   └── ic_launcher_round.png
│   │   │   │   │   ├── mipmap-xxxhdpi/
│   │   │   │   │   │   ├── ic_launcher.png
│   │   │   │   │   │   ├── ic_launcher_background.png
│   │   │   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   │   │   └── ic_launcher_round.png
│   │   │   │   │   ├── values/
│   │   │   │   │   │   ├── colors.xml
│   │   │   │   │   │   ├── ic_launcher_background.xml
│   │   │   │   │   │   ├── strings.xml
│   │   │   │   │   │   └── styles.xml
│   │   │   │   │   └── xml/
│   │   │   │   │       └── file_paths.xml
│   │   │   │   └── AndroidManifest.xml
│   │   │   └── test/
│   │   │       └── java/
│   │   │           └── com/
│   │   │               └── getcapacitor/
│   │   │                   └── myapp/
│   │   │                       └── ExampleUnitTest.java
│   │   ├── .gitignore
│   │   ├── build.gradle
│   │   ├── capacitor.build.gradle
│   │   └── proguard-rules.pro
│   ├── gradle/
│   │   └── wrapper/
│   │       ├── gradle-wrapper.jar
│   │       └── gradle-wrapper.properties
│   ├── .gitignore
│   ├── build.gradle
│   ├── capacitor.settings.gradle
│   ├── gradle.properties
│   ├── gradlew
│   ├── gradlew.bat
│   ├── settings.gradle
│   └── variables.gradle
├── assets/
│   ├── fonts/
│   │   ├── Caveat-Bold.ttf
│   │   ├── Manrope-Bold.ttf
│   │   ├── Manrope-Medium.ttf
│   │   └── Manrope-SemiBold.ttf
│   ├── playstore-listing/
│   │   ├── cards n background/
│   │   │   ├── Card1.png
│   │   │   ├── Card2.png
│   │   │   ├── Card3.png
│   │   │   ├── Card4.png
│   │   │   ├── Card5.png
│   │   │   ├── Card6.png
│   │   │   ├── Feed.png
│   │   │   ├── Home - Copy.png
│   │   │   ├── Home.png
│   │   │   ├── Message.png
│   │   │   ├── Notes.jpeg
│   │   │   └── explore.jpeg
│   │   └── designs/
│   │       ├── v1-designs (1).png
│   │       ├── v1-designs (2).png
│   │       ├── v1-designs (3).png
│   │       ├── v1-designs (4).png
│   │       └── v1-designs (5).png
│   └── ChatGPT Image Aug 11, 2026, 12_24_28 PM.png
├── docs/
│   ├── tooltips/
│   │   ├── TOOLTIPS_EXPLORE.md
│   │   ├── TOOLTIPS_HOME.md
│   │   ├── TOOLTIPS_MESSAGES.md
│   │   ├── TOOLTIPS_NOTES.md
│   │   └── TOOLTIPS_PLAY.md
│   ├── ANDROID.md
│   ├── ARCHITECTURE.md
│   ├── canvas-ui-change-plan.md
│   ├── content-metadata-architecture.md
│   ├── feed-architecture.md
│   ├── prisma-schema-cohort.md
│   └── study-rooms-schema.md
├── execution/
│   └── test_publish_and_verify.ts
├── prisma/
│   ├── db_backup.json
│   ├── schema.prisma
│   └── seed.ts
├── public/
│   ├── .well-known/
│   │   └── assetlinks.json
│   ├── fonts/
│   │   ├── Caveat-Bold.ttf
│   │   ├── Manrope-Bold.ttf
│   │   ├── Manrope-Medium.ttf
│   │   └── Manrope-SemiBold.ttf
│   ├── icons/
│   │   ├── 128/
│   │   │   ├── Ai.webp
│   │   │   ├── Article.webp
│   │   │   ├── Book.webp
│   │   │   ├── Bookmark.webp
│   │   │   ├── Calender.webp
│   │   │   ├── Headphone.webp
│   │   │   ├── Youtube.webp
│   │   │   └── floating-logo.webp
│   │   ├── 512/
│   │   │   ├── Ai.webp
│   │   │   ├── Article.webp
│   │   │   ├── Book.webp
│   │   │   ├── Bookmark.webp
│   │   │   ├── Calender.webp
│   │   │   ├── Headphone.webp
│   │   │   └── Youtube.webp
│   │   ├── icon-style-ref.png
│   │   └── screenshotquill.png
│   ├── images/
│   │   ├── auth/
│   │   │   ├── claude.webp
│   │   │   ├── faceless.webp
│   │   │   ├── maker.webp
│   │   │   └── phone.webp
│   │   ├── explore/
│   │   │   ├── cloud1.webp
│   │   │   ├── cloud2.webp
│   │   │   ├── cloud3.webp
│   │   │   ├── clouds.webp
│   │   │   └── explore-hero.webp
│   │   ├── home/
│   │   │   ├── crow.webp
│   │   │   └── home-hero.webp
│   │   ├── landing/
│   │   │   ├── before-sleep.webp
│   │   │   ├── cab-ride.webp
│   │   │   ├── coffee-break.webp
│   │   │   ├── hand.webp
│   │   │   ├── metro-ride.webp
│   │   │   ├── phone.webp
│   │   │   ├── screen.webp
│   │   │   └── waiting.webp
│   │   ├── mobile/
│   │   │   └── explore/
│   │   │       ├── bottle-content-mobile.webp
│   │   │       └── explore-hero-banner-mobile.webp
│   │   ├── mockups/
│   │   │   └── dashboard-microlearning.png
│   │   ├── studyrooms/
│   │   │   ├── campside.webp
│   │   │   ├── canal.webp
│   │   │   ├── fireplace.webp
│   │   │   ├── library.webp
│   │   │   ├── ruins.webp
│   │   │   ├── seaside.webp
│   │   │   └── shrine.webp
│   │   ├── footer-bg.jpeg
│   │   ├── footer-mascot.png
│   │   ├── hero-poster.webp
│   │   └── onlyMascot.png
│   ├── logos/
│   │   ├── apple.webp
│   │   ├── coursera-white.webp
│   │   ├── coursera.webp
│   │   ├── floating-logo.svg
│   │   ├── github.webp
│   │   ├── google.webp
│   │   ├── sidequesthq-logo-no-book-compass.svg
│   │   ├── sidequesthq-logo.svg
│   │   ├── slack.webp
│   │   ├── youtube-white.webp
│   │   └── youtube.webp
│   ├── mock/
│   │   ├── avatars/
│   │   │   ├── a.webp
│   │   │   ├── b.webp
│   │   │   ├── c.webp
│   │   │   ├── d.webp
│   │   │   ├── e.webp
│   │   │   ├── f.webp
│   │   │   ├── g.webp
│   │   │   ├── h.webp
│   │   │   ├── i.webp
│   │   │   ├── j.webp
│   │   │   ├── k.webp
│   │   │   ├── l.webp
│   │   │   ├── m.webp
│   │   │   └── n.webp
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
│   ├── favicon.ico
│   ├── file.svg
│   ├── globe.svg
│   └── window.svg
├── scripts/
│   ├── db-backup.mjs
│   ├── mobile-build.mjs
│   ├── mobile-release-aab.mjs
│   └── seedNotesData.ts
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
│   │   │   ├── create-cohort/
│   │   │   │   └── page.tsx
│   │   │   ├── explore/
│   │   │   │   └── page.tsx
│   │   │   ├── home/
│   │   │   │   └── page.tsx
│   │   │   ├── message/
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── notes/
│   │   │   │   └── page.tsx
│   │   │   ├── play/
│   │   │   │   └── page.tsx
│   │   │   ├── studyroom/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (landing)/
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── page.client.tsx
│   │   │   └── page.tsx
│   │   ├── [person]/
│   │   │   └── [platform]/
│   │   │       └── route.ts
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts
│   │   │   ├── cohort/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── join/
│   │   │   │   │       └── route.ts
│   │   │   │   └── publish/
│   │   │   │       └── route.ts
│   │   │   ├── community/
│   │   │   │   ├── [cohortId]/
│   │   │   │   │   └── channels/
│   │   │   │   │       └── route.ts
│   │   │   │   └── channels/
│   │   │   │       └── [channelId]/
│   │   │   │           └── messages/
│   │   │   │               └── route.ts
│   │   │   ├── corsair/
│   │   │   │   └── [[...path]]/
│   │   │   │       └── route.ts
│   │   │   ├── curriculum/
│   │   │   │   └── generate/
│   │   │   │       └── route.ts
│   │   │   ├── explore/
│   │   │   │   └── route.ts
│   │   │   ├── feed/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── route.pagination.test.ts
│   │   │   │   │   └── route.test.ts
│   │   │   │   └── route.ts
│   │   │   ├── import/
│   │   │   │   ├── github/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── notion/
│   │   │   │   │   └── route.ts
│   │   │   │   └── youtube/
│   │   │   │       ├── metadata/
│   │   │   │       │   └── route.ts
│   │   │   │       └── playlist/
│   │   │   │           └── route.ts
│   │   │   ├── progress/
│   │   │   │   └── chunk/
│   │   │   │       └── route.ts
│   │   │   ├── studyroom/
│   │   │   │   └── route.ts
│   │   │   └── workspace/
│   │   │       ├── canvas/
│   │   │       │   └── route.ts
│   │   │       └── notes/
│   │   │           └── route.ts
│   │   ├── features/
│   │   │   ├── ai-study-planner/
│   │   │   │   └── page.tsx
│   │   │   └── microlearning/
│   │   │       └── page.tsx
│   │   ├── policy/
│   │   │   └── page.tsx
│   │   ├── styles/
│   │   │   ├── accessibility.css
│   │   │   ├── buttons.css
│   │   │   ├── excalidraw.css
│   │   │   ├── forms.css
│   │   │   ├── layout.css
│   │   │   ├── print.css
│   │   │   ├── reset.css
│   │   │   ├── tokens.css
│   │   │   └── typography.css
│   │   ├── terms/
│   │   │   └── page.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── client/
│   │   ├── components/
│   │   │   ├── global/
│   │   │   │   ├── CapacitorBridge/
│   │   │   │   │   └── CapacitorBridge.tsx
│   │   │   │   ├── Card/
│   │   │   │   │   ├── Card.module.css
│   │   │   │   │   ├── Card.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── CommandPalette/
│   │   │   │   │   ├── CommandPalette.module.css
│   │   │   │   │   ├── CommandPalette.tsx
│   │   │   │   │   ├── CommandTrigger.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── DashboardShell/
│   │   │   │   │   ├── DashboardShell.module.css
│   │   │   │   │   ├── DashboardShell.tsx
│   │   │   │   │   └── RoutePreserver.tsx
│   │   │   │   ├── EmptyState/
│   │   │   │   │   ├── EmptyState.module.css
│   │   │   │   │   ├── EmptyState.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── Footer/
│   │   │   │   │   ├── Footer.module.css
│   │   │   │   │   └── Footer.tsx
│   │   │   │   ├── HorizontalScroller/
│   │   │   │   │   ├── HorizontalScroller.module.css
│   │   │   │   │   ├── HorizontalScroller.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── InfiniteScroller/
│   │   │   │   │   ├── InfiniteScroller.module.css
│   │   │   │   │   ├── InfiniteScroller.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── Logo/
│   │   │   │   │   ├── Logo.module.css
│   │   │   │   │   └── Logo.tsx
│   │   │   │   ├── Navbar/
│   │   │   │   │   ├── Navbar.module.css
│   │   │   │   │   └── Navbar.tsx
│   │   │   │   ├── NetworkOfflineIndicator/
│   │   │   │   │   ├── NetworkOfflineIndicator.module.css
│   │   │   │   │   └── NetworkOfflineIndicator.tsx
│   │   │   │   ├── ProtectedVideo/
│   │   │   │   │   └── ProtectedVideo.tsx
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
│   │   │   │   ├── Skeleton/
│   │   │   │   │   ├── PageSkeleton.module.css
│   │   │   │   │   ├── PageSkeleton.tsx
│   │   │   │   │   ├── Skeleton.module.css
│   │   │   │   │   ├── Skeleton.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── Toast/
│   │   │   │   │   ├── Toast.module.css
│   │   │   │   │   ├── Toast.tsx
│   │   │   │   │   ├── ToastProvider.tsx
│   │   │   │   │   └── index.ts
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
│   │   │   ├── theme/
│   │   │   │   └── theme.tsx
│   │   │   └── ui/
│   │   │       ├── Badge/
│   │   │       │   ├── Badge.module.css
│   │   │       │   └── Badge.tsx
│   │   │       ├── Button/
│   │   │       │   ├── Button.module.css
│   │   │       │   └── Button.tsx
│   │   │       ├── Calendar/
│   │   │       │   ├── Calendar.module.css
│   │   │       │   ├── Calendar.tsx
│   │   │       │   └── index.ts
│   │   │       ├── Divider/
│   │   │       │   ├── Divider.module.css
│   │   │       │   └── Divider.tsx
│   │   │       ├── FormEditor/
│   │   │       │   ├── FormEditor.module.css
│   │   │       │   ├── FormEditor.tsx
│   │   │       │   └── index.ts
│   │   │       ├── InlineEditor/
│   │   │       │   ├── InlineEditor.module.css
│   │   │       │   └── InlineEditor.tsx
│   │   │       ├── Slider/
│   │   │       │   ├── Slider.css
│   │   │       │   ├── Slider.tsx
│   │   │       │   └── SliderProgressEngine.tsx
│   │   │       ├── Tooltip/
│   │   │       │   ├── Tooltip.module.css
│   │   │       │   ├── Tooltip.tsx
│   │   │       │   └── index.ts
│   │   │       ├── Typography/
│   │   │       │   ├── Heading.module.css
│   │   │       │   ├── Heading.tsx
│   │   │       │   ├── Text.module.css
│   │   │       │   └── Text.tsx
│   │   │       └── index.ts
│   │   ├── config/
│   │   │   └── routeThemeConfig.ts
│   │   ├── hooks/
│   │   │   ├── useExperience.ts
│   │   │   ├── useIsMobile.ts
│   │   │   ├── usePullToRefresh.ts
│   │   │   ├── useSession.ts
│   │   │   ├── useSessions.ts
│   │   │   └── useToast.ts
│   │   ├── mobile/
│   │   │   ├── components/
│   │   │   │   └── navigation/
│   │   │   │       └── MobileNav/
│   │   │   │           ├── MobileNav.module.css
│   │   │   │           └── MobileNav.tsx
│   │   │   └── screens/
│   │   │       ├── Cohort/
│   │   │       │   ├── CohortMobile.module.css
│   │   │       │   └── CohortMobile.tsx
│   │   │       ├── CreateCohort/
│   │   │       │   ├── CreateCohortMobile.module.css
│   │   │       │   └── CreateCohortMobile.tsx
│   │   │       ├── Explore/
│   │   │       │   ├── components/
│   │   │       │   │   ├── ExploreHero/
│   │   │       │   │   │   ├── ExploreHero.module.css
│   │   │       │   │   │   └── ExploreHero.tsx
│   │   │       │   │   ├── ExploreSearch/
│   │   │       │   │   │   ├── ExploreSearch.module.css
│   │   │       │   │   │   └── ExploreSearch.tsx
│   │   │       │   │   ├── ExploreTopics/
│   │   │       │   │   │   ├── ExploreTopics.module.css
│   │   │       │   │   │   └── ExploreTopics.tsx
│   │   │       │   │   └── TrendingContentCard/
│   │   │       │   │       ├── TrendingContentCard.module.css
│   │   │       │   │       └── TrendingContentCard.tsx
│   │   │       │   ├── ExploreMobile.module.css
│   │   │       │   └── ExploreMobile.tsx
│   │   │       ├── Home/
│   │   │       │   ├── HomeMobile.module.css
│   │   │       │   └── HomeMobile.tsx
│   │   │       ├── Message/
│   │   │       │   ├── MessageMobile.module.css
│   │   │       │   └── MessageMobile.tsx
│   │   │       ├── Notes/
│   │   │       │   ├── components/
│   │   │       │   │   ├── MobileCanvasToolbar.module.css
│   │   │       │   │   └── MobileCanvasToolbar.tsx
│   │   │       │   ├── screens/
│   │   │       │   │   ├── CanvasScreen.tsx
│   │   │       │   │   ├── NotebooksScreen.tsx
│   │   │       │   │   └── WorkspaceScreen.tsx
│   │   │       │   ├── MobileStepShell.tsx
│   │   │       │   ├── NotesMobile.module.css
│   │   │       │   └── NotesMobile.tsx
│   │   │       └── Play/
│   │   │           ├── PlayMobile.module.css
│   │   │           └── PlayMobile.tsx
│   │   ├── mock/
│   │   │   └── avatars.ts
│   │   ├── navigation/
│   │   │   └── cohortLinks.ts
│   │   ├── providers/
│   │   │   ├── .gitkeep
│   │   │   └── ReactQueryProvider.tsx
│   │   ├── react-query/
│   │   │   └── query-client.ts
│   │   ├── redux/
│   │   │   └── store.ts
│   │   ├── repositories/
│   │   │   ├── cohortRepository.ts
│   │   │   ├── cohortStore.ts
│   │   │   ├── exploreRepository.ts
│   │   │   ├── feedRepository.ts
│   │   │   ├── homeRepository.ts
│   │   │   ├── homeStorageAdapter.ts
│   │   │   ├── messagesRepository.ts
│   │   │   └── storageAdapter.ts
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   │   ├── authForm/
│   │   │   │   │   ├── authButton.module.css
│   │   │   │   │   ├── authButton.tsx
│   │   │   │   │   ├── authDivider.module.css
│   │   │   │   │   ├── authDivider.tsx
│   │   │   │   │   ├── authForm.module.css
│   │   │   │   │   ├── authForm.tsx
│   │   │   │   │   ├── authInput.module.css
│   │   │   │   │   ├── authInput.tsx
│   │   │   │   │   ├── authLegal.module.css
│   │   │   │   │   ├── authLegal.tsx
│   │   │   │   │   ├── authProviders.module.css
│   │   │   │   │   ├── authProviders.tsx
│   │   │   │   │   ├── authStats.module.css
│   │   │   │   │   └── authStats.tsx
│   │   │   │   ├── authShowcase/
│   │   │   │   │   ├── authCommunityGrid.module.css
│   │   │   │   │   ├── authCommunityGrid.tsx
│   │   │   │   │   ├── authData.ts
│   │   │   │   │   ├── authFeaturedContent.module.css
│   │   │   │   │   ├── authFeaturedContent.tsx
│   │   │   │   │   ├── authHighlights.module.css
│   │   │   │   │   ├── authHighlights.tsx
│   │   │   │   │   ├── authPhone.module.css
│   │   │   │   │   ├── authPhone.tsx
│   │   │   │   │   ├── authShowcase.module.css
│   │   │   │   │   └── authShowcase.tsx
│   │   │   │   ├── .gitkeep
│   │   │   │   ├── Auth.module.css
│   │   │   │   ├── Auth.tsx
│   │   │   │   └── index.ts
│   │   │   ├── cohort/
│   │   │   │   ├── components/
│   │   │   │   │   ├── CohortHero/
│   │   │   │   │   │   ├── CohortHero.module.css
│   │   │   │   │   │   └── CohortHero.tsx
│   │   │   │   │   ├── CohortLayout/
│   │   │   │   │   │   ├── CohortLayout.module.css
│   │   │   │   │   │   └── CohortLayout.tsx
│   │   │   │   │   ├── CohortNavigation/
│   │   │   │   │   │   ├── CohortNavigation.module.css
│   │   │   │   │   │   └── CohortNavigation.tsx
│   │   │   │   │   ├── ProgressSidebar/
│   │   │   │   │   │   ├── ProgressSidebar.module.css
│   │   │   │   │   │   └── ProgressSidebar.tsx
│   │   │   │   │   ├── JoinCohortButton.module.css
│   │   │   │   │   └── JoinCohortButton.tsx
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── useArchives.ts
│   │   │   │   │   ├── useCohort.ts
│   │   │   │   │   ├── useEvents.ts
│   │   │   │   │   └── useQuestline.ts
│   │   │   │   ├── models/
│   │   │   │   │   ├── archives.ts
│   │   │   │   │   ├── cohort.ts
│   │   │   │   │   ├── events.ts
│   │   │   │   │   ├── hallOfFame.ts
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── navigation.ts
│   │   │   │   │   └── questline.ts
│   │   │   │   ├── tabs/
│   │   │   │   │   ├── archives/
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── ArchiveCard/
│   │   │   │   │   │   │   │   └── ArchiveCard.tsx
│   │   │   │   │   │   │   ├── ArchiveFeed/
│   │   │   │   │   │   │   │   └── ArchiveFeed.tsx
│   │   │   │   │   │   │   ├── ArchiveFilters/
│   │   │   │   │   │   │   │   └── ArchiveFilters.tsx
│   │   │   │   │   │   │   ├── ArchiveSearch/
│   │   │   │   │   │   │   │   └── ArchiveSearch.tsx
│   │   │   │   │   │   │   ├── ArchiveThumbnail/
│   │   │   │   │   │   │   │   └── ArchiveThumbnail.tsx
│   │   │   │   │   │   │   ├── ArchiveTypeBadge/
│   │   │   │   │   │   │   │   └── ArchiveTypeBadge.tsx
│   │   │   │   │   │   │   ├── ArchiveVoting/
│   │   │   │   │   │   │   │   └── ArchiveVoting.tsx
│   │   │   │   │   │   │   ├── ArchivesHeader/
│   │   │   │   │   │   │   │   └── ArchivesHeader.tsx
│   │   │   │   │   │   │   ├── ArchivesPage/
│   │   │   │   │   │   │   │   └── ArchivesPage.tsx
│   │   │   │   │   │   │   ├── ArchivesSidebar/
│   │   │   │   │   │   │   │   └── ArchivesSidebar.tsx
│   │   │   │   │   │   │   ├── ContributorsCard/
│   │   │   │   │   │   │   │   └── ContributorsCard.tsx
│   │   │   │   │   │   │   ├── ShareKnowledgeCard/
│   │   │   │   │   │   │   │   └── ShareKnowledgeCard.tsx
│   │   │   │   │   │   │   ├── SideCard/
│   │   │   │   │   │   │   │   └── SideCard.tsx
│   │   │   │   │   │   │   ├── SortingControls/
│   │   │   │   │   │   │   │   └── SortingControls.tsx
│   │   │   │   │   │   │   └── TrendingCard/
│   │   │   │   │   │   │       └── TrendingCard.tsx
│   │   │   │   │   │   ├── Archives.module.css
│   │   │   │   │   │   └── Archives.tsx
│   │   │   │   │   ├── events/
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── CalendarSync/
│   │   │   │   │   │   │   │   └── CalendarSync.tsx
│   │   │   │   │   │   │   ├── Card/
│   │   │   │   │   │   │   │   └── Card.tsx
│   │   │   │   │   │   │   ├── EventActions/
│   │   │   │   │   │   │   │   └── EventActions.tsx
│   │   │   │   │   │   │   ├── EventAttendance/
│   │   │   │   │   │   │   │   └── EventAttendance.tsx
│   │   │   │   │   │   │   ├── EventCard/
│   │   │   │   │   │   │   │   └── EventCard.tsx
│   │   │   │   │   │   │   ├── EventDateCard/
│   │   │   │   │   │   │   │   └── EventDateCard.tsx
│   │   │   │   │   │   │   ├── EventList/
│   │   │   │   │   │   │   │   └── EventList.tsx
│   │   │   │   │   │   │   ├── EventStatusBadge/
│   │   │   │   │   │   │   │   └── EventStatusBadge.tsx
│   │   │   │   │   │   │   ├── EventsFilters/
│   │   │   │   │   │   │   │   └── EventsFilters.tsx
│   │   │   │   │   │   │   ├── EventsHeader/
│   │   │   │   │   │   │   │   └── EventsHeader.tsx
│   │   │   │   │   │   │   ├── EventsPage/
│   │   │   │   │   │   │   │   └── EventsPage.tsx
│   │   │   │   │   │   │   ├── EventsSidebar/
│   │   │   │   │   │   │   │   └── EventsSidebar.tsx
│   │   │   │   │   │   │   ├── RSVPButton/
│   │   │   │   │   │   │   │   └── RSVPButton.tsx
│   │   │   │   │   │   │   ├── SuggestEvent/
│   │   │   │   │   │   │   │   └── SuggestEvent.tsx
│   │   │   │   │   │   │   └── ThisWeek/
│   │   │   │   │   │   │       └── ThisWeek.tsx
│   │   │   │   │   │   ├── Events.module.css
│   │   │   │   │   │   └── Events.tsx
│   │   │   │   │   ├── hallOfFame/
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── AchievementBadge/
│   │   │   │   │   │   │   │   └── AchievementBadge.tsx
│   │   │   │   │   │   │   ├── AchievementRow/
│   │   │   │   │   │   │   │   └── AchievementRow.tsx
│   │   │   │   │   │   │   ├── AchievementsCard/
│   │   │   │   │   │   │   │   └── AchievementsCard.tsx
│   │   │   │   │   │   │   ├── CategoryFilter/
│   │   │   │   │   │   │   │   └── CategoryFilter.tsx
│   │   │   │   │   │   │   ├── CategoryFilters/
│   │   │   │   │   │   │   │   └── CategoryFilters.tsx
│   │   │   │   │   │   │   ├── HallOfFameHeader/
│   │   │   │   │   │   │   │   └── HallOfFameHeader.tsx
│   │   │   │   │   │   │   ├── HallOfFamePage/
│   │   │   │   │   │   │   │   └── HallOfFamePage.tsx
│   │   │   │   │   │   │   ├── HallOfLegends/
│   │   │   │   │   │   │   │   └── HallOfLegends.tsx
│   │   │   │   │   │   │   ├── HallSidebar/
│   │   │   │   │   │   │   │   └── HallSidebar.tsx
│   │   │   │   │   │   │   ├── HighlightRow/
│   │   │   │   │   │   │   │   └── HighlightRow.tsx
│   │   │   │   │   │   │   ├── HighlightsCard/
│   │   │   │   │   │   │   │   └── HighlightsCard.tsx
│   │   │   │   │   │   │   ├── LeaderboardCard/
│   │   │   │   │   │   │   │   └── LeaderboardCard.tsx
│   │   │   │   │   │   │   ├── LeaderboardGrid/
│   │   │   │   │   │   │   │   └── LeaderboardGrid.tsx
│   │   │   │   │   │   │   ├── LegendsRow/
│   │   │   │   │   │   │   │   └── LegendsRow.tsx
│   │   │   │   │   │   │   ├── MedalIcon/
│   │   │   │   │   │   │   │   └── MedalIcon.tsx
│   │   │   │   │   │   │   ├── MetricBadge/
│   │   │   │   │   │   │   │   └── MetricBadge.tsx
│   │   │   │   │   │   │   ├── SideCard/
│   │   │   │   │   │   │   │   └── SideCard.tsx
│   │   │   │   │   │   │   └── TimeRangeDropdown/
│   │   │   │   │   │   │       └── TimeRangeDropdown.tsx
│   │   │   │   │   │   ├── HallOfFame.module.css
│   │   │   │   │   │   └── HallOfFame.tsx
│   │   │   │   │   ├── overview/
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── AboutSection/
│   │   │   │   │   │   │   │   ├── AboutSection.module.css
│   │   │   │   │   │   │   │   └── AboutSection.tsx
│   │   │   │   │   │   │   ├── ExpeditionProgressCard/
│   │   │   │   │   │   │   │   ├── ExpeditionProgressCard.module.css
│   │   │   │   │   │   │   │   └── ExpeditionProgressCard.tsx
│   │   │   │   │   │   │   ├── ExpeditionStatsCard/
│   │   │   │   │   │   │   │   ├── ExpeditionStatsCard.module.css
│   │   │   │   │   │   │   │   └── ExpeditionStatsCard.tsx
│   │   │   │   │   │   │   ├── JourneySummary/
│   │   │   │   │   │   │   │   ├── JourneySummary.module.css
│   │   │   │   │   │   │   │   └── JourneySummary.tsx
│   │   │   │   │   │   │   ├── LearningChecklist/
│   │   │   │   │   │   │   │   ├── LearningChecklist.module.css
│   │   │   │   │   │   │   │   └── LearningChecklist.tsx
│   │   │   │   │   │   │   ├── LearningPillars/
│   │   │   │   │   │   │   │   ├── LearningPillars.module.css
│   │   │   │   │   │   │   │   └── LearningPillars.tsx
│   │   │   │   │   │   │   ├── OverviewIcon/
│   │   │   │   │   │   │   │   └── OverviewIcon.tsx
│   │   │   │   │   │   │   └── QuestGuideCard/
│   │   │   │   │   │   │       ├── QuestGuideCard.module.css
│   │   │   │   │   │   │       └── QuestGuideCard.tsx
│   │   │   │   │   │   ├── Overview.module.css
│   │   │   │   │   │   └── Overview.tsx
│   │   │   │   │   └── questline/
│   │   │   │   │       ├── components/
│   │   │   │   │       │   ├── AssignmentsProjectsFeed/
│   │   │   │   │       │   │   ├── AssignmentsProjectsFeed.module.css
│   │   │   │   │       │   │   └── AssignmentsProjectsFeed.tsx
│   │   │   │   │       │   ├── FeedCard/
│   │   │   │   │       │   │   ├── FeedCard.module.css
│   │   │   │   │       │   │   └── FeedCard.tsx
│   │   │   │   │       │   ├── LessonList/
│   │   │   │   │       │   │   ├── LessonList.module.css
│   │   │   │   │       │   │   └── LessonList.tsx
│   │   │   │   │       │   ├── LessonRow/
│   │   │   │   │       │   │   ├── LessonRow.module.css
│   │   │   │   │       │   │   └── LessonRow.tsx
│   │   │   │   │       │   ├── LessonStatusBadge/
│   │   │   │   │       │   │   ├── LessonStatusBadge.module.css
│   │   │   │   │       │   │   └── LessonStatusBadge.tsx
│   │   │   │   │       │   ├── LessonTypeBadge/
│   │   │   │   │       │   │   ├── LessonTypeBadge.module.css
│   │   │   │   │       │   │   └── LessonTypeBadge.tsx
│   │   │   │   │       │   ├── LockedFutureNotice/
│   │   │   │   │       │   │   ├── LockedFutureNotice.module.css
│   │   │   │   │       │   │   └── LockedFutureNotice.tsx
│   │   │   │   │       │   ├── QuestlineFilters/
│   │   │   │   │       │   │   ├── QuestlineFilters.module.css
│   │   │   │   │       │   │   └── QuestlineFilters.tsx
│   │   │   │   │       │   ├── QuestlineIcon/
│   │   │   │   │       │   │   └── QuestlineIcon.tsx
│   │   │   │   │       │   ├── SeasonCard/
│   │   │   │   │       │   │   ├── SeasonCard.module.css
│   │   │   │   │       │   │   └── SeasonCard.tsx
│   │   │   │   │       │   ├── SeasonSummary/
│   │   │   │   │       │   │   ├── SeasonSummary.module.css
│   │   │   │   │       │   │   └── SeasonSummary.tsx
│   │   │   │   │       │   ├── SeasonTimeline/
│   │   │   │   │       │   │   ├── SeasonTimeline.module.css
│   │   │   │   │       │   │   └── SeasonTimeline.tsx
│   │   │   │   │       │   └── SkipSeasonDropdown/
│   │   │   │   │       │       ├── SkipSeasonDropdown.module.css
│   │   │   │   │       │       └── SkipSeasonDropdown.tsx
│   │   │   │   │       ├── Questline.module.css
│   │   │   │   │       └── Questline.tsx
│   │   │   │   ├── Cohort.module.css
│   │   │   │   ├── Cohort.tsx
│   │   │   │   ├── CohortDesktop.tsx
│   │   │   │   └── index.ts
│   │   │   ├── dashboard/
│   │   │   │   ├── createCohort/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── CommunityConfig/
│   │   │   │   │   │   │   ├── CommunityConfig.module.css
│   │   │   │   │   │   │   └── CommunityConfig.tsx
│   │   │   │   │   │   ├── CurriculumBoard/
│   │   │   │   │   │   │   ├── CurriculumBoard.module.css
│   │   │   │   │   │   │   └── CurriculumBoard.tsx
│   │   │   │   │   │   ├── CurriculumBulkBar/
│   │   │   │   │   │   │   ├── CurriculumBulkBar.module.css
│   │   │   │   │   │   │   └── CurriculumBulkBar.tsx
│   │   │   │   │   │   ├── CurriculumChecklist/
│   │   │   │   │   │   │   ├── CurriculumChecklist.module.css
│   │   │   │   │   │   │   └── CurriculumChecklist.tsx
│   │   │   │   │   │   ├── CurriculumContextMenu/
│   │   │   │   │   │   │   ├── CurriculumContextMenu.module.css
│   │   │   │   │   │   │   └── CurriculumContextMenu.tsx
│   │   │   │   │   │   ├── CurriculumInspector/
│   │   │   │   │   │   │   ├── CurriculumInspector.module.css
│   │   │   │   │   │   │   └── CurriculumInspector.tsx
│   │   │   │   │   │   ├── CurriculumQuality/
│   │   │   │   │   │   │   ├── CurriculumQuality.module.css
│   │   │   │   │   │   │   └── CurriculumQuality.tsx
│   │   │   │   │   │   ├── CurriculumShortcutsModal/
│   │   │   │   │   │   │   ├── CurriculumShortcutsModal.module.css
│   │   │   │   │   │   │   └── CurriculumShortcutsModal.tsx
│   │   │   │   │   │   ├── CurriculumStats/
│   │   │   │   │   │   │   ├── CurriculumStats.module.css
│   │   │   │   │   │   │   └── CurriculumStats.tsx
│   │   │   │   │   │   ├── CurriculumStep/
│   │   │   │   │   │   │   ├── CurriculumStep.module.css
│   │   │   │   │   │   │   └── CurriculumStep.tsx
│   │   │   │   │   │   ├── CurriculumToolbar/
│   │   │   │   │   │   │   ├── CurriculumToolbar.module.css
│   │   │   │   │   │   │   └── CurriculumToolbar.tsx
│   │   │   │   │   │   ├── CurriculumWarnings/
│   │   │   │   │   │   │   ├── CurriculumWarnings.module.css
│   │   │   │   │   │   │   └── CurriculumWarnings.tsx
│   │   │   │   │   │   ├── DetailsStep/
│   │   │   │   │   │   │   ├── DetailsStep.module.css
│   │   │   │   │   │   │   └── DetailsStep.tsx
│   │   │   │   │   │   ├── IdentityStep/
│   │   │   │   │   │   │   ├── IdentityStep.module.css
│   │   │   │   │   │   │   └── IdentityStep.tsx
│   │   │   │   │   │   ├── ImportWorkspace/
│   │   │   │   │   │   │   ├── ImportWorkspace.module.css
│   │   │   │   │   │   │   └── ImportWorkspace.tsx
│   │   │   │   │   │   ├── JourneySettingsConfig/
│   │   │   │   │   │   │   ├── JourneySettingsConfig.module.css
│   │   │   │   │   │   │   └── JourneySettingsConfig.tsx
│   │   │   │   │   │   ├── LaunchChecklist/
│   │   │   │   │   │   │   ├── LaunchChecklist.module.css
│   │   │   │   │   │   │   └── LaunchChecklist.tsx
│   │   │   │   │   │   ├── LaunchStep/
│   │   │   │   │   │   │   ├── LaunchStep.module.css
│   │   │   │   │   │   │   └── LaunchStep.tsx
│   │   │   │   │   │   ├── LaunchSuccess/
│   │   │   │   │   │   │   ├── LaunchSuccess.module.css
│   │   │   │   │   │   │   └── LaunchSuccess.tsx
│   │   │   │   │   │   ├── LearnerPreview/
│   │   │   │   │   │   │   ├── LearnerPreview.module.css
│   │   │   │   │   │   │   └── LearnerPreview.tsx
│   │   │   │   │   │   ├── OnboardingConfig/
│   │   │   │   │   │   │   ├── OnboardingConfig.module.css
│   │   │   │   │   │   │   └── OnboardingConfig.tsx
│   │   │   │   │   │   ├── PublishingModal/
│   │   │   │   │   │   │   ├── PublishingModal.module.css
│   │   │   │   │   │   │   └── PublishingModal.tsx
│   │   │   │   │   │   ├── SourcesStep/
│   │   │   │   │   │   │   ├── SourceCard.module.css
│   │   │   │   │   │   │   ├── SourceCard.tsx
│   │   │   │   │   │   │   ├── SourcesStep.module.css
│   │   │   │   │   │   │   └── SourcesStep.tsx
│   │   │   │   │   │   ├── TopicStep/
│   │   │   │   │   │   │   ├── TopicStep.module.css
│   │   │   │   │   │   │   └── TopicStep.tsx
│   │   │   │   │   │   ├── VideoWeightsModal/
│   │   │   │   │   │   │   ├── VideoWeightsModal.module.css
│   │   │   │   │   │   │   └── VideoWeightsModal.tsx
│   │   │   │   │   │   ├── WizardFooter/
│   │   │   │   │   │   │   ├── WizardFooter.module.css
│   │   │   │   │   │   │   └── WizardFooter.tsx
│   │   │   │   │   │   └── WizardStepper/
│   │   │   │   │   │       ├── WizardStepper.module.css
│   │   │   │   │   │       └── WizardStepper.tsx
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   ├── useCreateCohortModels.ts
│   │   │   │   │   │   ├── useCurriculumQuality.ts
│   │   │   │   │   │   └── useKeyboardShortcuts.ts
│   │   │   │   │   ├── mock/
│   │   │   │   │   │   ├── createCohort.mock.ts
│   │   │   │   │   │   └── curriculum.mock.ts
│   │   │   │   │   ├── models/
│   │   │   │   │   │   ├── createCohort.ts
│   │   │   │   │   │   ├── import.ts
│   │   │   │   │   │   ├── intelligence.ts
│   │   │   │   │   │   └── launch.ts
│   │   │   │   │   ├── providers/
│   │   │   │   │   │   └── WizardProvider.tsx
│   │   │   │   │   ├── services/
│   │   │   │   │   │   ├── bulkOperationsService.ts
│   │   │   │   │   │   ├── curriculumService.ts
│   │   │   │   │   │   ├── importService.ts
│   │   │   │   │   │   └── publishService.ts
│   │   │   │   │   ├── utils/
│   │   │   │   │   │   └── securityValidation.ts
│   │   │   │   │   ├── CreateCohort.module.css
│   │   │   │   │   ├── CreateCohort.tsx
│   │   │   │   │   ├── CreateCohortDesktop.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── explore/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── BrowseTopics/
│   │   │   │   │   │   │   ├── BrowseTopics.module.css
│   │   │   │   │   │   │   ├── BrowseTopics.tsx
│   │   │   │   │   │   │   ├── TopicChip.module.css
│   │   │   │   │   │   │   └── TopicChip.tsx
│   │   │   │   │   │   ├── CloudBed/
│   │   │   │   │   │   │   ├── CloudBed.module.css
│   │   │   │   │   │   │   └── CloudBed.tsx
│   │   │   │   │   │   ├── ExploreHero/
│   │   │   │   │   │   │   ├── ExploreHero.module.css
│   │   │   │   │   │   │   └── ExploreHero.tsx
│   │   │   │   │   │   ├── PeopleFinishing/
│   │   │   │   │   │   │   ├── ArcCarousel.module.css
│   │   │   │   │   │   │   ├── ArcCarousel.tsx
│   │   │   │   │   │   │   ├── PeopleFinishing.module.css
│   │   │   │   │   │   │   ├── PeopleFinishing.tsx
│   │   │   │   │   │   │   ├── TrendingCourseCard.module.css
│   │   │   │   │   │   │   └── TrendingCourseCard.tsx
│   │   │   │   │   │   ├── RecentlyPublished/
│   │   │   │   │   │   │   ├── ArticleCard.module.css
│   │   │   │   │   │   │   ├── ArticleCard.tsx
│   │   │   │   │   │   │   ├── RecentlyPublished.module.css
│   │   │   │   │   │   │   └── RecentlyPublished.tsx
│   │   │   │   │   │   ├── SectionHeader/
│   │   │   │   │   │   │   ├── SectionHeader.module.css
│   │   │   │   │   │   │   └── SectionHeader.tsx
│   │   │   │   │   │   ├── StudyRooms/
│   │   │   │   │   │   │   ├── StudyRoomCard.module.css
│   │   │   │   │   │   │   ├── StudyRoomCard.tsx
│   │   │   │   │   │   │   ├── StudyRooms.module.css
│   │   │   │   │   │   │   └── StudyRooms.tsx
│   │   │   │   │   │   └── TrendingSideQuests/
│   │   │   │   │   │       ├── SideQuestCard.module.css
│   │   │   │   │   │       ├── SideQuestCard.tsx
│   │   │   │   │   │       ├── TrendingSideQuests.module.css
│   │   │   │   │   │       └── TrendingSideQuests.tsx
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   └── useExplore.ts
│   │   │   │   │   ├── models/
│   │   │   │   │   │   ├── articlePreview.ts
│   │   │   │   │   │   ├── explore.ts
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   ├── search.ts
│   │   │   │   │   │   ├── sidequest.ts
│   │   │   │   │   │   ├── topic.ts
│   │   │   │   │   │   └── trending-course.ts
│   │   │   │   │   ├── Explore.module.css
│   │   │   │   │   ├── Explore.tsx
│   │   │   │   │   ├── ExploreDesktop.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── home/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── ActiveCohortRow/
│   │   │   │   │   │   │   ├── ActiveCohortRow.module.css
│   │   │   │   │   │   │   └── ActiveCohortRow.tsx
│   │   │   │   │   │   ├── ActiveCohorts/
│   │   │   │   │   │   │   ├── ActiveCohorts.module.css
│   │   │   │   │   │   │   ├── ActiveCohorts.tsx
│   │   │   │   │   │   │   ├── InspectorPanel.module.css
│   │   │   │   │   │   │   └── InspectorPanel.tsx
│   │   │   │   │   │   ├── ChannelHub/
│   │   │   │   │   │   │   ├── ChannelHub.module.css
│   │   │   │   │   │   │   └── ChannelHub.tsx
│   │   │   │   │   │   ├── CompletedCourseCard/
│   │   │   │   │   │   │   ├── CompletedCourseCard.module.css
│   │   │   │   │   │   │   └── CompletedCourseCard.tsx
│   │   │   │   │   │   ├── ContinueLater/
│   │   │   │   │   │   │   ├── ContinueLater.module.css
│   │   │   │   │   │   │   └── ContinueLater.tsx
│   │   │   │   │   │   ├── ContinueLaterCard/
│   │   │   │   │   │   │   ├── ContinueLaterCard.module.css
│   │   │   │   │   │   │   └── ContinueLaterCard.tsx
│   │   │   │   │   │   ├── HomeHero/
│   │   │   │   │   │   │   ├── HomeHero.module.css
│   │   │   │   │   │   │   └── HomeHero.tsx
│   │   │   │   │   │   ├── HomeSummaryBar/
│   │   │   │   │   │   │   ├── HomeSummaryBar.module.css
│   │   │   │   │   │   │   └── HomeSummaryBar.tsx
│   │   │   │   │   │   ├── RecentlyCompleted/
│   │   │   │   │   │   │   ├── RecentlyCompleted.module.css
│   │   │   │   │   │   │   └── RecentlyCompleted.tsx
│   │   │   │   │   │   └── SectionHeader/
│   │   │   │   │   │       ├── SectionHeader.module.css
│   │   │   │   │   │       └── SectionHeader.tsx
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   └── useHome.ts
│   │   │   │   │   ├── models/
│   │   │   │   │   │   ├── home.ts
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── utils/
│   │   │   │   │   │   ├── cohortManagement.ts
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   └── scroll.ts
│   │   │   │   │   ├── Home.module.css
│   │   │   │   │   ├── Home.tsx
│   │   │   │   │   ├── HomeDesktop.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── message/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── Center/
│   │   │   │   │   │   │   ├── LiveCard/
│   │   │   │   │   │   │   │   ├── LiveCard.module.css
│   │   │   │   │   │   │   │   └── LiveCard.tsx
│   │   │   │   │   │   │   ├── LiveNow/
│   │   │   │   │   │   │   │   ├── LiveNow.module.css
│   │   │   │   │   │   │   │   └── LiveNow.tsx
│   │   │   │   │   │   │   ├── RecentMessageItem/
│   │   │   │   │   │   │   │   ├── RecentMessageItem.module.css
│   │   │   │   │   │   │   │   └── RecentMessageItem.tsx
│   │   │   │   │   │   │   ├── RecentMessages/
│   │   │   │   │   │   │   │   ├── RecentMessages.module.css
│   │   │   │   │   │   │   │   └── RecentMessages.tsx
│   │   │   │   │   │   │   ├── SearchHeader/
│   │   │   │   │   │   │   │   ├── SearchHeader.module.css
│   │   │   │   │   │   │   │   └── SearchHeader.tsx
│   │   │   │   │   │   │   ├── Center.module.css
│   │   │   │   │   │   │   └── Center.tsx
│   │   │   │   │   │   ├── CommunityChat/
│   │   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   │   ├── AvatarConnector/
│   │   │   │   │   │   │   │   │   ├── AvatarConnector.module.css
│   │   │   │   │   │   │   │   │   └── AvatarConnector.tsx
│   │   │   │   │   │   │   │   ├── ChannelTabs/
│   │   │   │   │   │   │   │   │   ├── ChannelTabs.module.css
│   │   │   │   │   │   │   │   │   └── ChannelTabs.tsx
│   │   │   │   │   │   │   │   ├── CommunityHeader/
│   │   │   │   │   │   │   │   │   ├── CommunityHeader.module.css
│   │   │   │   │   │   │   │   │   └── CommunityHeader.tsx
│   │   │   │   │   │   │   │   ├── CommunitySidebar/
│   │   │   │   │   │   │   │   │   ├── CommunitySidebar.module.css
│   │   │   │   │   │   │   │   │   └── CommunitySidebar.tsx
│   │   │   │   │   │   │   │   ├── DateDivider/
│   │   │   │   │   │   │   │   │   ├── DateDivider.module.css
│   │   │   │   │   │   │   │   │   └── DateDivider.tsx
│   │   │   │   │   │   │   │   ├── InReplyTo/
│   │   │   │   │   │   │   │   │   ├── InReplyTo.module.css
│   │   │   │   │   │   │   │   │   └── InReplyTo.tsx
│   │   │   │   │   │   │   │   ├── MediaGallery/
│   │   │   │   │   │   │   │   │   ├── MediaGallery.module.css
│   │   │   │   │   │   │   │   │   └── MediaGallery.tsx
│   │   │   │   │   │   │   │   ├── MembersStrip/
│   │   │   │   │   │   │   │   │   ├── MembersStrip.module.css
│   │   │   │   │   │   │   │   │   └── MembersStrip.tsx
│   │   │   │   │   │   │   │   ├── MessageAttachment/
│   │   │   │   │   │   │   │   │   ├── MessageAttachment.module.css
│   │   │   │   │   │   │   │   │   └── MessageAttachment.tsx
│   │   │   │   │   │   │   │   ├── MessageBubble/
│   │   │   │   │   │   │   │   │   ├── MessageBubble.module.css
│   │   │   │   │   │   │   │   │   └── MessageBubble.tsx
│   │   │   │   │   │   │   │   ├── MessageComposer/
│   │   │   │   │   │   │   │   │   ├── MessageComposer.module.css
│   │   │   │   │   │   │   │   │   └── MessageComposer.tsx
│   │   │   │   │   │   │   │   ├── MessageTimeline/
│   │   │   │   │   │   │   │   │   ├── MessageTimeline.module.css
│   │   │   │   │   │   │   │   │   └── MessageTimeline.tsx
│   │   │   │   │   │   │   │   ├── PinnedBanner/
│   │   │   │   │   │   │   │   │   ├── PinnedBanner.module.css
│   │   │   │   │   │   │   │   │   └── PinnedBanner.tsx
│   │   │   │   │   │   │   │   ├── PinnedMessages/
│   │   │   │   │   │   │   │   │   ├── PinnedMessages.module.css
│   │   │   │   │   │   │   │   │   └── PinnedMessages.tsx
│   │   │   │   │   │   │   │   ├── ReactionBar/
│   │   │   │   │   │   │   │   │   ├── ReactionBar.module.css
│   │   │   │   │   │   │   │   │   └── ReactionBar.tsx
│   │   │   │   │   │   │   │   ├── ReplyBanner/
│   │   │   │   │   │   │   │   │   ├── ReplyBanner.module.css
│   │   │   │   │   │   │   │   │   └── ReplyBanner.tsx
│   │   │   │   │   │   │   │   ├── ReplyPreview/
│   │   │   │   │   │   │   │   │   ├── ReplyPreview.module.css
│   │   │   │   │   │   │   │   │   └── ReplyPreview.tsx
│   │   │   │   │   │   │   │   └── UpcomingEvents/
│   │   │   │   │   │   │   │       ├── UpcomingEvents.module.css
│   │   │   │   │   │   │   │       └── UpcomingEvents.tsx
│   │   │   │   │   │   │   ├── CommunityChat.module.css
│   │   │   │   │   │   │   └── CommunityChat.tsx
│   │   │   │   │   │   ├── DMConversation/
│   │   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   │   ├── AboutCard/
│   │   │   │   │   │   │   │   │   ├── AboutCard.module.css
│   │   │   │   │   │   │   │   │   └── AboutCard.tsx
│   │   │   │   │   │   │   │   ├── DMBubble/
│   │   │   │   │   │   │   │   │   ├── DMBubble.module.css
│   │   │   │   │   │   │   │   │   └── DMBubble.tsx
│   │   │   │   │   │   │   │   ├── DMComposer/
│   │   │   │   │   │   │   │   │   ├── DMComposer.module.css
│   │   │   │   │   │   │   │   │   └── DMComposer.tsx
│   │   │   │   │   │   │   │   ├── DMHeader/
│   │   │   │   │   │   │   │   │   ├── DMHeader.module.css
│   │   │   │   │   │   │   │   │   └── DMHeader.tsx
│   │   │   │   │   │   │   │   ├── DMProfileSidebar/
│   │   │   │   │   │   │   │   │   ├── DMProfileSidebar.module.css
│   │   │   │   │   │   │   │   │   └── DMProfileSidebar.tsx
│   │   │   │   │   │   │   │   ├── DateDivider/
│   │   │   │   │   │   │   │   │   ├── DateDivider.module.css
│   │   │   │   │   │   │   │   │   └── DateDivider.tsx
│   │   │   │   │   │   │   │   ├── MessageReaction/
│   │   │   │   │   │   │   │   │   ├── MessageReaction.module.css
│   │   │   │   │   │   │   │   │   └── MessageReaction.tsx
│   │   │   │   │   │   │   │   ├── MessageStatus/
│   │   │   │   │   │   │   │   │   ├── MessageStatus.module.css
│   │   │   │   │   │   │   │   │   └── MessageStatus.tsx
│   │   │   │   │   │   │   │   ├── MessageTimeline/
│   │   │   │   │   │   │   │   │   ├── MessageTimeline.module.css
│   │   │   │   │   │   │   │   │   └── MessageTimeline.tsx
│   │   │   │   │   │   │   │   ├── NotificationCard/
│   │   │   │   │   │   │   │   │   ├── NotificationCard.module.css
│   │   │   │   │   │   │   │   │   └── NotificationCard.tsx
│   │   │   │   │   │   │   │   ├── QuickActions/
│   │   │   │   │   │   │   │   │   ├── QuickActions.module.css
│   │   │   │   │   │   │   │   │   └── QuickActions.tsx
│   │   │   │   │   │   │   │   ├── ResourceList/
│   │   │   │   │   │   │   │   │   ├── ResourceList.module.css
│   │   │   │   │   │   │   │   │   └── ResourceList.tsx
│   │   │   │   │   │   │   │   └── UserHero/
│   │   │   │   │   │   │   │       ├── UserHero.module.css
│   │   │   │   │   │   │   │       └── UserHero.tsx
│   │   │   │   │   │   │   ├── DMConversation.module.css
│   │   │   │   │   │   │   └── DMConversation.tsx
│   │   │   │   │   │   ├── LeftSidebar/
│   │   │   │   │   │   │   ├── ComposeModal/
│   │   │   │   │   │   │   │   ├── ComposeModal.module.css
│   │   │   │   │   │   │   │   └── ComposeModal.tsx
│   │   │   │   │   │   │   ├── ConversationItem/
│   │   │   │   │   │   │   │   ├── ConversationItem.module.css
│   │   │   │   │   │   │   │   └── ConversationItem.tsx
│   │   │   │   │   │   │   ├── ConversationList/
│   │   │   │   │   │   │   │   ├── ConversationList.module.css
│   │   │   │   │   │   │   │   └── ConversationList.tsx
│   │   │   │   │   │   │   ├── SidebarFilters/
│   │   │   │   │   │   │   │   ├── SidebarFilters.module.css
│   │   │   │   │   │   │   │   └── SidebarFilters.tsx
│   │   │   │   │   │   │   ├── SidebarHeader/
│   │   │   │   │   │   │   │   ├── SidebarHeader.module.css
│   │   │   │   │   │   │   │   └── SidebarHeader.tsx
│   │   │   │   │   │   │   ├── LeftSidebar.module.css
│   │   │   │   │   │   │   └── LeftSidebar.tsx
│   │   │   │   │   │   ├── MessageComposer/
│   │   │   │   │   │   │   ├── composers/
│   │   │   │   │   │   │   │   ├── CommunityComposer.tsx
│   │   │   │   │   │   │   │   ├── DMComposer.module.css
│   │   │   │   │   │   │   │   └── DMComposer.tsx
│   │   │   │   │   │   │   ├── MessageComposer.module.css
│   │   │   │   │   │   │   └── MessageComposer.tsx
│   │   │   │   │   │   ├── RightSidebar/
│   │   │   │   │   │   │   ├── DailyChallenge/
│   │   │   │   │   │   │   │   ├── DailyChallenge.module.css
│   │   │   │   │   │   │   │   └── DailyChallenge.tsx
│   │   │   │   │   │   │   ├── FriendAvatarGroup/
│   │   │   │   │   │   │   │   ├── FriendAvatarGroup.module.css
│   │   │   │   │   │   │   │   └── FriendAvatarGroup.tsx
│   │   │   │   │   │   │   ├── FriendsOnline/
│   │   │   │   │   │   │   │   ├── FriendsOnline.module.css
│   │   │   │   │   │   │   │   └── FriendsOnline.tsx
│   │   │   │   │   │   │   ├── UpcomingCard/
│   │   │   │   │   │   │   │   ├── UpcomingCard.module.css
│   │   │   │   │   │   │   │   └── UpcomingCard.tsx
│   │   │   │   │   │   │   ├── UpcomingEvents/
│   │   │   │   │   │   │   │   ├── UpcomingEvents.module.css
│   │   │   │   │   │   │   │   └── UpcomingEvents.tsx
│   │   │   │   │   │   │   ├── RightSidebar.module.css
│   │   │   │   │   │   │   └── RightSidebar.tsx
│   │   │   │   │   │   ├── SocialLanding/
│   │   │   │   │   │   │   ├── SocialLanding.module.css
│   │   │   │   │   │   │   └── SocialLanding.tsx
│   │   │   │   │   │   └── shared/
│   │   │   │   │   │       ├── ContextMenu/
│   │   │   │   │   │       │   ├── ContextMenu.module.css
│   │   │   │   │   │       │   └── ContextMenu.tsx
│   │   │   │   │   │       ├── EmptyState/
│   │   │   │   │   │       │   ├── EmptyState.module.css
│   │   │   │   │   │       │   ├── EmptyState.tsx
│   │   │   │   │   │       │   └── index.ts
│   │   │   │   │   │       ├── Skeleton/
│   │   │   │   │   │       │   ├── Skeleton.module.css
│   │   │   │   │   │       │   ├── Skeleton.tsx
│   │   │   │   │   │       │   └── index.ts
│   │   │   │   │   │       ├── TypingIndicator/
│   │   │   │   │   │       │   ├── TypingIndicator.module.css
│   │   │   │   │   │       │   └── TypingIndicator.tsx
│   │   │   │   │   │       └── index.ts
│   │   │   │   │   ├── constants/
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   └── message.constants.ts
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   ├── useCommunity.ts
│   │   │   │   │   │   └── useMessage.ts
│   │   │   │   │   ├── mock/
│   │   │   │   │   │   ├── communityChat.mock.ts
│   │   │   │   │   │   ├── dmConversation.mock.ts
│   │   │   │   │   │   └── message.mock.ts
│   │   │   │   │   ├── models/
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   └── message.ts
│   │   │   │   │   ├── types/
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── utils/
│   │   │   │   │   │   ├── communityMapping.ts
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── Message.module.css
│   │   │   │   │   ├── Message.tsx
│   │   │   │   │   ├── MessageDesktop.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── notes/
│   │   │   │   │   ├── adapters/
│   │   │   │   │   │   ├── canvas.adapter.ts
│   │   │   │   │   │   └── notes.adapter.ts
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── NotesCanvas/
│   │   │   │   │   │   │   ├── ExcalidrawWrapper.tsx
│   │   │   │   │   │   │   ├── HamburgerGridControls.module.css
│   │   │   │   │   │   │   ├── HamburgerGridControls.tsx
│   │   │   │   │   │   │   ├── NotesCanvas.module.css
│   │   │   │   │   │   │   └── NotesCanvas.tsx
│   │   │   │   │   │   ├── NotesKanban/
│   │   │   │   │   │   │   ├── CardEditor.tsx
│   │   │   │   │   │   │   ├── KanbanCard.tsx
│   │   │   │   │   │   │   ├── NotesKanban.module.css
│   │   │   │   │   │   │   ├── NotesKanban.tsx
│   │   │   │   │   │   │   └── kanban-dark.css
│   │   │   │   │   │   ├── NotesSaveStatus/
│   │   │   │   │   │   │   ├── NotesSaveStatus.module.css
│   │   │   │   │   │   │   └── NotesSaveStatus.tsx
│   │   │   │   │   │   ├── RightColumn/
│   │   │   │   │   │   │   ├── RecentlyClosedSection.tsx
│   │   │   │   │   │   │   ├── RightColumn.module.css
│   │   │   │   │   │   │   ├── SpaceHeader.tsx
│   │   │   │   │   │   │   ├── TasksSection.tsx
│   │   │   │   │   │   │   └── WorkspaceSection.tsx
│   │   │   │   │   │   ├── NotesComponents.tsx
│   │   │   │   │   │   ├── NotesSidebar.module.css
│   │   │   │   │   │   ├── NotesSidebar.tsx
│   │   │   │   │   │   ├── NotesWorkspace.tsx
│   │   │   │   │   │   └── SidebarNavHeader.tsx
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   ├── useCanvasPersistence.ts
│   │   │   │   │   │   ├── useCanvasScene.ts
│   │   │   │   │   │   ├── useNotes.ts
│   │   │   │   │   │   ├── useNotesKeyboardShortcuts.ts
│   │   │   │   │   │   ├── useNotesNavigation.ts
│   │   │   │   │   │   └── useRecentlyClosedNotes.ts
│   │   │   │   │   ├── mock/
│   │   │   │   │   │   ├── canvas.seed.ts
│   │   │   │   │   │   └── notes.seed.ts
│   │   │   │   │   ├── models/
│   │   │   │   │   │   ├── canvas.models.ts
│   │   │   │   │   │   └── notes.models.ts
│   │   │   │   │   ├── repositories/
│   │   │   │   │   │   ├── canvas.repository.ts
│   │   │   │   │   │   └── notes.repository.ts
│   │   │   │   │   ├── Notes.module.css
│   │   │   │   │   ├── Notes.tsx
│   │   │   │   │   ├── NotesDesktop.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── play/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── CinematicStage/
│   │   │   │   │   │   │   ├── CinematicStage.module.css
│   │   │   │   │   │   │   └── CinematicStage.tsx
│   │   │   │   │   │   ├── LearningTimeline/
│   │   │   │   │   │   │   ├── LearningTimeline.module.css
│   │   │   │   │   │   │   └── LearningTimeline.tsx
│   │   │   │   │   │   ├── LessonCard/
│   │   │   │   │   │   │   ├── LessonCard.module.css
│   │   │   │   │   │   │   └── LessonCard.tsx
│   │   │   │   │   │   ├── PlaybackControls/
│   │   │   │   │   │   │   ├── PlaybackControls.module.css
│   │   │   │   │   │   │   ├── PlaybackControls.tsx
│   │   │   │   │   │   │   ├── VolumeControl.module.css
│   │   │   │   │   │   │   └── VolumeControl.tsx
│   │   │   │   │   │   ├── PlayerSurface/
│   │   │   │   │   │   │   ├── PlayerSurface.module.css
│   │   │   │   │   │   │   └── PlayerSurface.tsx
│   │   │   │   │   │   ├── PlayerToolbar/
│   │   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   │   ├── BookmarkButton.tsx
│   │   │   │   │   │   │   │   ├── CaptureButton.tsx
│   │   │   │   │   │   │   │   ├── PlaybackSpeed.tsx
│   │   │   │   │   │   │   │   ├── ScribeButton.tsx
│   │   │   │   │   │   │   │   ├── ToolbarMenu.tsx
│   │   │   │   │   │   │   │   └── index.ts
│   │   │   │   │   │   │   ├── PlayerToolbar.module.css
│   │   │   │   │   │   │   └── PlayerToolbar.tsx
│   │   │   │   │   │   ├── ChannelSelector.tsx
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── hooks/
│   │   │   │   │   │   ├── __tests__/
│   │   │   │   │   │   │   └── usePlayback.test.ts
│   │   │   │   │   │   ├── use1DGesture.ts
│   │   │   │   │   │   └── usePlayback.ts
│   │   │   │   │   ├── types/
│   │   │   │   │   │   ├── play.mock.ts
│   │   │   │   │   │   └── play.ts
│   │   │   │   │   ├── Play.module.css
│   │   │   │   │   ├── Play.tsx
│   │   │   │   │   ├── PlayDesktop.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   └── studyroom/
│   │   │   │       ├── StudyRoomScreen.module.css
│   │   │   │       ├── StudyRoomScreen.tsx
│   │   │   │       └── index.ts
│   │   │   └── landing/
│   │   │       ├── 01-hero/
│   │   │       │   ├── Hero.module.css
│   │   │       │   ├── Hero.tsx
│   │   │       │   ├── heroContent.module.css
│   │   │       │   ├── heroContent.tsx
│   │   │       │   ├── heroFloatingContentIcons.module.css
│   │   │       │   ├── heroFloatingContentIcons.tsx
│   │   │       │   ├── heroNavbar.module.css
│   │   │       │   ├── heroNavbar.tsx
│   │   │       │   ├── heroScene.tsx
│   │   │       │   └── index.ts
│   │   │       ├── 02-ikigai/
│   │   │       │   ├── CalendarMonth/
│   │   │       │   │   ├── CalendarMonth.module.css
│   │   │       │   │   ├── CalendarMonth.tsx
│   │   │       │   │   ├── calendarData.ts
│   │   │       │   │   ├── calendarMonth.types.ts
│   │   │       │   │   ├── calendarTypes.ts
│   │   │       │   │   └── calendarUtils.ts
│   │   │       │   ├── FeatureSection.module.css
│   │   │       │   ├── FeatureSection.tsx
│   │   │       │   ├── Ikigai.tsx
│   │   │       │   ├── ProgressSection.module.css
│   │   │       │   ├── ProgressSection.tsx
│   │   │       │   ├── ikigaiTimeline.module.css
│   │   │       │   ├── ikigaiTimeline.tsx
│   │   │       │   ├── index.ts
│   │   │       │   ├── learningList.module.css
│   │   │       │   └── learningList.tsx
│   │   │       ├── 05-Features/
│   │   │       │   ├── Features.tsx
│   │   │       │   └── index.ts
│   │   │       ├── 06-footer/
│   │   │       │   ├── Footer.tsx
│   │   │       │   └── index.ts
│   │   │       └── .gitkeep
│   │   └── utils/
│   │       ├── haptics.ts
│   │       └── isNative.ts
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
│   │   ├── database/
│   │   │   └── mongo/
│   │   │       └── models/
│   │   │           ├── Chunk.ts
│   │   │           ├── CohortTranscript.ts
│   │   │           └── UserChunkProgress.ts
│   │   ├── domain/
│   │   │   ├── cohort/
│   │   │   │   ├── chunking.service.ts
│   │   │   │   ├── cohort.service.ts
│   │   │   │   ├── transcript-coherence.service.ts
│   │   │   │   └── vectorScoring.service.ts
│   │   │   ├── progress/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── chunkProgress.service.test.ts
│   │   │   │   │   └── chunkProgress.test.ts
│   │   │   │   └── chunkProgress.service.ts
│   │   │   ├── session/
│   │   │   │   ├── session.services.ts
│   │   │   │   └── session.types.ts
│   │   │   └── user/
│   │   │       └── user.types.ts
│   │   ├── imports/
│   │   │   ├── github/
│   │   │   │   └── github-import.service.ts
│   │   │   ├── notion/
│   │   │   │   └── notion-import.service.ts
│   │   │   └── youtube/
│   │   │       ├── youtube-errors.ts
│   │   │       ├── youtube-import.service.ts
│   │   │       └── youtube-url.ts
│   │   ├── infrastructure/
│   │   │   ├── ai/
│   │   │   │   └── .gitkeep
│   │   │   ├── auth/
│   │   │   │   ├── auth.config.ts
│   │   │   │   ├── getUser.ts
│   │   │   │   └── requireUser.ts
│   │   │   ├── db/
│   │   │   │   ├── mock/
│   │   │   │   │   └── repositories/
│   │   │   │   │       └── explore.repo.ts
│   │   │   │   ├── mongodb/
│   │   │   │   │   ├── models/
│   │   │   │   │   │   └── UserWorkspace.ts
│   │   │   │   │   ├── repositories/
│   │   │   │   │   │   └── workspace.repo.ts
│   │   │   │   │   ├── client.ts
│   │   │   │   │   └── schema.prisma.ts
│   │   │   │   └── postgres/
│   │   │   │       ├── mappers/
│   │   │   │       │   └── cohortMapper.ts
│   │   │   │       ├── repositories/
│   │   │   │       │   ├── cohort.repo.ts
│   │   │   │       │   ├── community.repo.ts
│   │   │   │       │   ├── session.repo.ts
│   │   │   │       │   ├── studyRoom.repo.ts
│   │   │   │       │   └── user.repo.ts
│   │   │   │       ├── schema/
│   │   │   │       │   └── index.ts
│   │   │   │       └── client.ts
│   │   │   ├── external/
│   │   │   │   └── scratch.txt
│   │   │   └── workflows/
│   │   │       └── cohortVectorizationWorkflow.ts
│   │   └── corsair.ts
│   ├── shared/
│   │   ├── api/
│   │   │   └── apiUrl.ts
│   │   ├── constants/
│   │   │   └── app.constants.ts
│   │   ├── curriculum/
│   │   │   ├── __tests__/
│   │   │   │   └── pedagogicalVector.test.ts
│   │   │   ├── curriculum.generator.ts
│   │   │   ├── curriculum.types.ts
│   │   │   ├── index.ts
│   │   │   ├── pedagogicalVector.engine.ts
│   │   │   └── pedagogicalVector.types.ts
│   │   ├── feed/
│   │   │   ├── __tests__/
│   │   │   │   └── feedEngine.test.ts
│   │   │   ├── feedEngine.ts
│   │   │   ├── feedEngine.types.ts
│   │   │   ├── feedScoring.ts
│   │   │   └── index.ts
│   │   ├── lib/
│   │   │   ├── errors/
│   │   │   │   └── AppError.ts
│   │   │   ├── utils/
│   │   │   │   ├── calculateScore.ts
│   │   │   │   └── formatDate.ts
│   │   │   └── validators/
│   │   │       ├── session.validator.ts
│   │   │       └── user.validator.ts
│   │   └── mobile/
│   │       └── cohortStaticParams.ts
│   └── middleware.ts
├── .gitignore
├── .prettierignore
├── .prettierrc
├── AGENTS.md
├── CLAUDE.md
├── GEMINI.md
├── README.md
├── build-aab.bat
├── capacitor.config.ts
├── eslint.config.mjs
├── excalidraw.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── phasewise.md
├── postcss.config.mjs
├── prisma.config.ts
├── skills-lock.json
├── task.md
├── tsconfig.json
└── vitest.config.mts

537 directories, 1153 files

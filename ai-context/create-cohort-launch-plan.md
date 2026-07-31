# Create Cohort Launch Experience & Publishing Plan

## Scope
This document defines Prompt 5 (the final step) of the Create Cohort flow: Launch Experience, Learner Preview, Onboarding & Community Configuration, Publishing Workflow, and Celebration Experience.

The architecture stays inside the existing SideQuestHQ dashboard conventions:
- Screen-first module structure inside `src/client/components/screens/dashboard/createCohort/`
- Reuses actual learner components (`Overview`, `Questline`, `Player`, `Assignments`, `Events`, `Archives`, `Hall of Fame`)
- Local provider state (`WizardProvider`)
- Presentation-model-driven UI
- Clean service boundaries (`PublishService` -> `/api/cohort/publish`)
- No raw backend DTOs exposed to the client UI

---

## Publishing Architecture

The publishing boundary is split into four distinct layers:

1. **WizardProvider (Client Orchestration)**: Maintains current launch configuration, learner preview state, onboarding settings, community toggles, and live publishing progress.
2. **PublishService (Client Service Boundary)**: Manages network requests, state transitions (`Draft` -> `Preparing Assets` -> `Generating Search Metadata` -> `Creating Community` -> `Publishing` -> `Live`), and error mapping.
3. **Next.js API Route (`/api/cohort/publish/route.ts`)**: Server-side validation, metadata enrichment, and endpoint interface for future database/backend integration.
4. **Publish Presentation Models (`PublishResultModel`, `PublishStateModel`)**: Clean contracts returned to the UI upon successful publishing.

---

## Learner Preview Architecture

The Learner Preview allows creators to view their cohort through a real-time learner lens:

- **Component Reuse**: Rather than duplicating cards or views, the preview renders the exact production learner components adapted to consume draft presentation models.
- **Tabbed Views**:
  - `Overview`: Course landing hero, syllabus preview, and cohort information.
  - `Questline`: Season and lesson progression map.
  - `Player`: Interactive video lesson player with 5-minute chunk navigation.
  - `Assignments`: Task and exercise list.
  - `Events`: Scheduled community sessions.
  - `Archives`: Historical cohort records.
  - `Hall of Fame`: Top learner achievements.
- **Device Viewports**:
  - `Desktop` (100% width canvas)
  - `Tablet` (768px frame)
  - `Mobile` (375px frame)

---

## Onboarding Experience

The onboarding configuration equips creators to set first-time learner expectations:

- `welcomeMessage`: Personal creator greeting displayed on first join.
- `journeyIntroduction`: Video or text intro setting the course vision.
- `recommendedDailyGoal`: Target daily study time (e.g. `20 mins/day`).
- `suggestedWeeklyCommitment`: Expected weekly effort (e.g. `3 hours/week`).
- `completionMotivation`: Inspiring message for finishing the cohort.
- `communityGuidelines`: Standard or custom conduct rules.
- `pinnedResources`: Highlighted starter links and tools.

---

## Community Configuration

Creators can toggle community features with clear descriptions of what each feature enables:

- `discussionFeed`: Main community post stream.
- `assignments`: Submissions and peer reviews.
- `projects`: Capstone showcase.
- `publicNotes`: Shared learner note-taking.
- `archives`: Recorded live sessions.
- `hallOfFame`: Milestone achievements and badges.
- `events`: Live calendar & office hours.
- `leaderboards`: Gamified XP standings.
- `communityChat`: Real-time chat channels.
- `qAndA`: Question and answer forum.

---

## Publishing Workflow

Publishing is a multi-stage, progress-driven experience:

$$\text{Draft} \longrightarrow \text{Preparing Assets} \longrightarrow \text{Generating Search Metadata} \longrightarrow \text{Creating Community} \longrightarrow \text{Publishing} \longrightarrow \text{Live}$$

### States:
1. `draft`: Creator is configuring settings.
2. `preparing-assets`: Uploading cover images, normalising thumbnails.
3. `search-metadata`: Indexing categories, difficulty, and search keywords.
4. `creating-community`: Provisioning chat channels and discussion feed.
5. `publishing`: Saving final cohort payload to database.
6. `live`: Launch complete! Success celebration displayed.

---

## Launch Validation (Blocking vs Warnings vs Suggestions)

Validation is categorized into three strict tiers:

- **Blocking Issues** (Must be resolved to enable `Publish Cohort` button):
  - Missing title or description
  - No imported/generated lessons
  - Invalid / 0-duration lessons
  - Empty seasons
- **Warnings** (Non-blocking, but highlighted):
  - Missing lesson thumbnails
  - Unnamed season titles
  - Missing community welcome message
- **Suggestions** (Optional quality enhancements):
  - Low XP rewards
  - Missing recommended daily goal

Every checklist item includes a direct click handler (`onClick={() => setStep('...')}`) to navigate directly to the affected wizard step.

---

## Versioning & Future Backend Boundaries

The data model includes versioning fields for future backend capability:

- `version`: SemVer string (e.g., `1.0.0`)
- `publishedAt`: ISO date timestamp
- `status`: `'draft' | 'published' | 'updated-draft' | 'archived'`
- `hasUnpublishedChanges`: boolean flag indicating draft diffs since last publish
- `history`: Version history metadata array placeholder for rollback capabilities.

---

## Folder Additions

```
src/
├── app/api/cohort/publish/route.ts
├── client/components/screens/dashboard/createCohort/
│   ├── components/
│   │   ├── LaunchStep/            (Root Step 4 component)
│   │   ├── LearnerPreview/        (Responsive viewport canvas & view switcher)
│   │   ├── OnboardingConfig/      (Welcome message, daily goals, guidelines)
│   │   ├── CommunityConfig/       (Feature toggle switches)
│   │   ├── JourneySettingsConfig/ (Visibility, language, keywords)
│   │   ├── LaunchChecklist/       (Polished clickable validation checklist)
│   │   ├── PublishingModal/       (Multi-stage publishing progress overlay)
│   │   └── LaunchSuccess/         (Celebration page upon launch)
│   ├── models/
│   │   └── launch.ts              (Launch, onboarding, community, and versioning types)
│   └── services/
│       └── publishService.ts      (Client publishing API boundary)
```

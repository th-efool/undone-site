# Team 3: Edge ISR Cohort Subpages & Catalog Revalidation (ISR-Converter-Lead)

## 1. Executive Summary
- **Lead Role**: `ISR-Converter-Lead`
- **Subagents Deployed**:
  - `Sub-3A (CohortArchivesEventsIsr)`: Cohort Archives, Events, and Root Redirect ISR Conversion
  - `Sub-3B (HallOfFameCatalogRevalidation)`: Hall of Fame ISR Conversion & Synchronized On-Demand Cache Invalidation
- **Problem**:
  - `/cohort/[cohortId]/archives`, `/cohort/[cohortId]/events`, and `/cohort/[cohortId]/hall-of-fame` called `(await auth())?.user?.id` and executed un-indexed, un-pruned `prisma.cohort.findFirst` with full season and lesson relations on every page load.
  - This forced Next.js to classify all 3 subpages as dynamic on-demand serverless functions (`ƒ Dynamic`), spinning up a Vercel Lambda and hammering PostgreSQL on every request.
  - `/cohort/[cohortId]` called `auth()` in `generateMetadata`, turning a simple redirect into a dynamic serverless invocation.
  - Cache revalidation in `release/route.ts` only purged `/overview` and `/questline`, leaving `/archives`, `/events`, and `/hall-of-fame` stale. `publish/route.ts` lacked cache invalidation entirely.
- **Solution Delivered**:
  - Converted `/archives`, `/events`, `/hall-of-fame`, and `/cohort/[cohortId]` to Edge ISR (`revalidate = 3600`) by fetching via cached `getPublicCohort(cohortId)`.
  - Created lazy private fallbacks: [`PrivateArchives.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/archives/PrivateArchives.tsx), [`PrivateEvents.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/events/PrivateEvents.tsx), and [`PrivateHallOfFame.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/hall-of-fame/PrivateHallOfFame.tsx) backed by memoized `getPrivateCohortContext`.
  - Replaced dynamic auth in root redirect `generateMetadata` with `getPublicCohort(cohortId)`.
  - Synchronized full on-demand cache revalidation in `release/route.ts` and `publish/route.ts`: invalidates `cohortTag(id)`, all 6 cohort subroutes, `/explore`, and `/sitemap.xml`.

---

## 2. Code Review Pro - Deliverables

### A. Sub-3A: Cohort Archives & Events ISR Caching
- **Files Modified / Created**:
  - [`src/app/(dashboard)/cohort/[cohortId]/archives/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/archives/page.tsx)
  - [`src/app/(dashboard)/cohort/[cohortId]/archives/PrivateArchives.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/archives/PrivateArchives.tsx)
  - [`src/app/(dashboard)/cohort/[cohortId]/events/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/events/page.tsx)
  - [`src/app/(dashboard)/cohort/[cohortId]/events/PrivateEvents.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/events/PrivateEvents.tsx)
  - [`src/app/(dashboard)/cohort/[cohortId]/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/page.tsx)
- **Unit Tests**:
  - `src/app/(dashboard)/cohort/[cohortId]/archives/__tests__/page.test.tsx` (5 tests passing)
  - `src/app/(dashboard)/cohort/[cohortId]/events/__tests__/page.test.tsx` (5 tests passing)
  - `src/app/(dashboard)/cohort/[cohortId]/__tests__/page.test.tsx` (3 tests passing)

### B. Sub-3B: Hall of Fame & Cache Revalidation
- **Files Modified / Created**:
  - [`src/app/(dashboard)/cohort/[cohortId]/hall-of-fame/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/hall-of-fame/page.tsx)
  - [`src/app/(dashboard)/cohort/[cohortId]/hall-of-fame/PrivateHallOfFame.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(dashboard)/cohort/[cohortId]/hall-of-fame/PrivateHallOfFame.tsx)
  - [`src/app/api/cohort-builder/workspaces/[workspaceId]/release/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/api/cohort-builder/workspaces/[workspaceId]/release/route.ts)
  - [`src/app/api/cohort/publish/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/api/cohort/publish/route.ts)
- **Unit Tests**:
  - `src/app/(dashboard)/cohort/[cohortId]/hall-of-fame/__tests__/page.test.tsx` (5 tests passing)
  - `src/app/api/cohort/publish/__tests__/revalidate.test.ts` (3 tests passing)
  - `src/app/api/cohort/publish/__tests__/route.test.ts` (7 tests passing)

---

## 3. Verification & Quality Gates
- **TypeScript**: `npx tsc --noEmit` passed with 0 errors.
- **Unit Tests**: 30/30 tests passed across cohort subpages and publish revalidation suites.
- **Edge Invalidation Coverage**:
  - `revalidateTag(cohortTag(id), 'max')`
  - `revalidatePath('/cohort/[id]')`
  - `revalidatePath('/cohort/[id]/overview')`
  - `revalidatePath('/cohort/[id]/questline')`
  - `revalidatePath('/cohort/[id]/archives')`
  - `revalidatePath('/cohort/[id]/events')`
  - `revalidatePath('/cohort/[id]/hall-of-fame')`
  - `revalidatePath('/explore')`
  - `revalidatePath('/sitemap.xml')`

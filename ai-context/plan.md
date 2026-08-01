# Play Store Readiness & App Data Architecture Plan

This document details the complete technical architecture, data strategy, and component modifications required to make the **SideQuestHQ** Android App production-ready for the Google Play Store.

> [!IMPORTANT]
> **Scope Scoping**: All changes detailed in this plan apply **STRICTLY TO THE APP BUILD (`isNativeApp()`)** and will NOT alter or break the existing web platform behavior.

---

## 1. Core Objectives & Requirements Summary

1. **Fake Mock Data Removal (App Only)**:
   - Filter out dummy/mock catalog items (e.g. `deepWorkMastery`, `german-language-a1`, `system-design-bootcamp`, `docker-kubernetes`) from all app views (`/home`, `/explore`, `/cohort`).
   - Preserve website behavior in web browser mode.

2. **Disable `/message` Route & Community Links Entirely (App Only)**:
   - Remove the **Messages** navigation item from the App's bottom navigation bar.
   - Disable/hide **Discuss** and **Community** buttons on Cohort detail headers.
   - Add a route guard on `/message` in native app mode that automatically redirects to `/home`.

3. **Explore Screen Data Mapping (`/explore`)**:
   - **Trending SideQuests**: Mock data is allowed to be retained *only* in this section.
   - **People Are Finishing These**: Replace fake items with our **5 real data-backed cohorts**:
     1. **DSA — Only What's Needed** (`dsa-only-whats-needed` | Kunal Kushwaha)
     2. **Operating Systems** (`operating-systems-core` | CodeHelp - by Babbar)
     3. **Rajvansh: Dynasties Of India** (`rajvansh-dynasties-of-india` | EPIC TV)
     4. **Networking** (`networking-fundamentals` | Network Kings)
     5. **Celtic Mythology** (`celtic-mythology` | See U in History / Mythology)

4. **Persistent Storage for User-Created Cohorts in APK**:
   - Ensure user-created cohorts (published via `/create-cohort`) persist across app restarts, force-closes, and APK updates using a hybrid storage adapter combining `Capacitor Preferences` (`SharedPreferences` on Android) and `localStorage`.

5. **Play Store Policy Compliance Audit**:
   - Prevent Play Store rejections by eliminating dead links, non-functional stub buttons, missing privacy policy references, and uncaught exceptions.

---

## 2. Technical Architecture & Environment Detection

### 2.1 Native Environment Detection Helper
Create a centralized utility file `src/client/utils/isNative.ts`:
```typescript
/**
 * Detects if the current environment is running inside the Capacitor Android native shell.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}
```

---

## 3. Persistent Storage Architecture for User Cohorts

To guarantee that user-created cohorts survive app restarts and OS memory sweeps:

### 3.1 Hybrid Storage Adapter (`src/client/repositories/storageAdapter.ts`)
1. **Primary Layer**: `@capacitor/preferences` (Native Android `SharedPreferences`).
2. **Fallback Layer**: `window.localStorage`.
3. **Rehydration Flow**:
   - On app startup, `cohortStore` initializes asynchronously from `@capacitor/preferences`.
   - When a user publishes a cohort in `/create-cohort`, `cohortStore.registerPublishedCohort()` writes to both `localStorage` and `@capacitor/preferences`.

---

## 4. Component & Repository Changes

### 4.1 `cohortStore.ts` & `cohortRepository.ts`
- **In Web Mode**: `getAll()` returns full catalog (including mock items for web demonstration).
- **In App Mode (`isNativeApp()`)**: `getAll()` returns:
  - User-created/published cohorts (loaded from persistent storage).
  - The **5 Real Data-Backed Cohorts** (`feedCohorts`):
    - `dsa-only-whats-needed`
    - `operating-systems-core`
    - `rajvansh-dynasties-of-india`
    - `networking-fundamentals`
    - `celtic-mythology`
  - *All other dummy/mock catalog items are excluded in App mode.*

### 4.2 Explore Repository & Models (`src/client/repositories/exploreRepository.ts`)
Update `getExplore()` to handle app vs web data branching:
- **"People Are Finishing These"**: Map directly to the 5 real data-backed cohorts:
  ```typescript
  const realPeopleFinishing: TrendingCourse[] = [
    {
      id: 'dsa-only-whats-needed',
      title: "DSA — Only What's Needed",
      provider: 'youtube',
      thumbnail: 'https://i.ytimg.com/vi/rZ41y93P2Qo/maxresdefault.jpg',
      durationLabel: '8h 45m',
      learnerCount: '8.4k learners',
      rating: 4.9,
      featuredLearners: [/* avatar references */],
    },
    {
      id: 'operating-systems-core',
      title: 'Operating Systems',
      provider: 'youtube',
      thumbnail: 'https://i.ytimg.com/vi/3obEP8eLsCw/maxresdefault.jpg',
      durationLabel: '16h 23m',
      learnerCount: '5.6k learners',
      rating: 4.7,
      featuredLearners: [/* avatar references */],
    },
    {
      id: 'rajvansh-dynasties-of-india',
      title: 'Rajvansh: Dynasties Of India',
      provider: 'youtube',
      thumbnail: 'https://i.ytimg.com/vi/mHE5iGgQHj0/maxresdefault.jpg',
      durationLabel: '8h 30m',
      learnerCount: '5.2k learners',
      rating: 4.95,
      featuredLearners: [/* avatar references */],
    },
    {
      id: 'networking-fundamentals',
      title: 'Networking',
      provider: 'youtube',
      thumbnail: 'https://i.ytimg.com/vi/nGvpClgugEI/maxresdefault.jpg',
      durationLabel: '14h 15m',
      learnerCount: '4.2k learners',
      rating: 4.8,
      featuredLearners: [/* avatar references */],
    },
    {
      id: 'celtic-mythology',
      title: 'Celtic Mythology',
      provider: 'youtube',
      thumbnail: 'https://i.ytimg.com/vi/hMP_V2WWl3s/maxresdefault.jpg',
      durationLabel: '3h 30m',
      learnerCount: '3.1k learners',
      rating: 4.9,
      featuredLearners: [/* avatar references */],
    },
  ];
  ```
- **"Trending SideQuests"**: Retain mock items (as permitted).
- **"Recently Published"**: Surface user-created cohorts followed by the 5 real cohorts.

---

### 4.3 Navigation & Disabling `/message`

#### 1. Sidebar (`src/client/components/global/Sidebar/Sidebar.tsx` & `sidebar.data.ts`)
- Dynamically filter `SIDEBAR_ITEMS`:
  ```typescript
  export function useSidebarItems() {
    return useMemo(() => {
      if (isNativeApp()) {
        return SIDEBAR_ITEMS.filter((item) => item.href !== '/message');
      }
      return SIDEBAR_ITEMS;
    }, []);
  }
  ```

#### 2. Cohort Headers (`CohortHero.tsx` & `CohortLayout.tsx`)
- Conditionally hide or disable community/discuss buttons when `isNativeApp()` is true.

#### 3. Route Guard (`src/app/(dashboard)/message/page.tsx`)
- Add a client-side check in `useEffect`:
  ```typescript
  if (isNativeApp()) {
    router.replace('/home');
  }
  ```

---

## 5. Play Store Compliance & Risk Audit

To eliminate any potential reasons for Google Play Store rejection:

| Potential Policy Flag | Risk Level | Mitigation Strategy |
| :--- | :--- | :--- |
| **Broken / Dead Navigation** | High | All navigation paths lead to active real cohorts or functional screens (`/home`, `/play`, `/explore`, `/notes`, `/create-cohort`). `/message` is hidden and guarded. |
| **Non-Functional Buttons** | Medium | Hide/disable placeholder actions (e.g. social share / discuss buttons that lack backend endpoints in app). |
| **App Crash on Data Error** | High | Wrap JSON parsing and local storage calls in try/catch blocks; fallback to the 5 built-in real cohorts. |
| **Data Loss on Restart** | High | Capacitor Preferences integration ensures user-created cohorts persist across app restarts. |
| **Physical Back Button** | Medium | Verified `CapacitorBridge` handling so hardware back button navigates history or exits app cleanly without blank screens. |

---

## 6. Implementation Plan Milestones (For Future Execution)

1. **Step 1**: Create `isNative.ts` helper and `storageAdapter.ts` with Capacitor Preferences support.
2. **Step 2**: Update `cohortStore.ts` & `cohortRepository.ts` to filter mock data in App mode and rehydrate user cohorts persistently.
3. **Step 3**: Update `exploreRepository.ts` to populate "People Are Finishing These" with the 5 real data-backed cohorts.
4. **Step 4**: Filter `/message` from Sidebar navigation, Cohort detail pages, and add `/message` route guard.
5. **Step 5**: Perform full compilation and build signed production release AAB (`versionCode 7` / `versionName 2.1.0`).

---

*This plan is fully detailed and ready for user review before execution.*

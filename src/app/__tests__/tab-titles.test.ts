import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
  Manrope: () => ({ variable: '--font-manrope' }),
  Caveat: () => ({ variable: '--font-caveat' }),
  Dancing_Script: () => ({ variable: '--font-dancing-script' }),
  Lora: () => ({ variable: '--font-lora' }),
  Playfair_Display: () => ({ variable: '--font-playfair' }),
}));

import { metadata as rootMetadata } from '../layout';
import { metadata as playMetadata } from '../(dashboard)/play/page';
import { metadata as exploreMetadata } from '../(dashboard)/explore/page';
import { metadata as homeMetadata } from '../(dashboard)/home/page';
import { metadata as notesMetadata } from '../(dashboard)/notes/page';
import { metadata as messageMetadata } from '../(dashboard)/message/layout';
import { metadata as studyroomMetadata } from '../(dashboard)/studyroom/page';
import { metadata as createCohortMetadata } from '../(dashboard)/create-cohort/page';
import { metadata as cohortIndexMetadata } from '../(dashboard)/cohort/page';
import { metadata as authMetadata } from '../(auth)/auth/page';
import { metadata as landingMetadata } from '../(landing)/page';
import { metadata as policyMetadata } from '../policy/page';
import { metadata as termsMetadata } from '../terms/page';
import { metadata as aiPlannerMetadata } from '../features/ai-study-planner/page';
import { metadata as microlearningMetadata } from '../features/microlearning/page';
import { metadata as archivesMetadata } from '../(dashboard)/cohort/[cohortId]/archives/page';
import { metadata as eventsMetadata } from '../(dashboard)/cohort/[cohortId]/events/page';
import { metadata as hallOfFameMetadata } from '../(dashboard)/cohort/[cohortId]/hall-of-fame/page';
import { metadata as newQuestMetadata } from '../(creation)/quest/new/page';
import { metadata as startQuestMetadata } from '../(creation)/quest/start/page';
import { metadata as questDraftMetadata } from '../(creation)/quest/draft/[draftId]/page';
import { metadata as questBuildMetadata } from '../(creation)/quest/build/[workspaceId]/page';

describe('Browser tab titles across the Undone site', () => {
  const template = (rootMetadata.title as { template: string }).template;

  function resolveTitle(pageTitle: unknown): string {
    if (!pageTitle) return (rootMetadata.title as { default: string }).default;
    if (typeof pageTitle === 'string') {
      return template.replace('%s', pageTitle);
    }
    if (typeof pageTitle === 'object' && pageTitle !== null) {
      const obj = pageTitle as { absolute?: string; default?: string };
      if (obj.absolute) return obj.absolute;
      if (obj.default) return template.replace('%s', obj.default);
    }
    return String(pageTitle);
  }

  it('configures root layout template to "Undone > %s"', () => {
    expect(rootMetadata.title).toEqual({
      default: 'Undone',
      template: 'Undone > %s',
    });
  });

  const routeMetadatas: Array<{ name: string; metadata: any; expectedTitle: string }> = [
    { name: 'Play', metadata: playMetadata, expectedTitle: 'Undone > Play' },
    { name: 'Explore', metadata: exploreMetadata, expectedTitle: 'Undone > Explore' },
    { name: 'Dashboard', metadata: homeMetadata, expectedTitle: 'Undone > Dashboard' },
    { name: 'Notes', metadata: notesMetadata, expectedTitle: 'Undone > Notes' },
    { name: 'Messages', metadata: messageMetadata, expectedTitle: 'Undone > Messages' },
    { name: 'Study Rooms', metadata: studyroomMetadata, expectedTitle: 'Undone > Study Rooms' },
    { name: 'Create a Cohort', metadata: createCohortMetadata, expectedTitle: 'Undone > Create a Cohort' },
    { name: 'Cohorts', metadata: cohortIndexMetadata, expectedTitle: 'Undone > Cohorts' },
    { name: 'Sign In', metadata: authMetadata, expectedTitle: 'Undone > Sign In' },
    { name: 'Privacy Policy', metadata: policyMetadata, expectedTitle: 'Undone > Privacy Policy' },
    { name: 'Terms of Service', metadata: termsMetadata, expectedTitle: 'Undone > Terms of Service' },
    { name: 'AI Study Planner & Tracker', metadata: aiPlannerMetadata, expectedTitle: 'Undone > AI Study Planner & Tracker' },
    { name: 'Microlearning App', metadata: microlearningMetadata, expectedTitle: 'Undone > Microlearning App — Learn Anything in 5 Minutes a Day' },
    { name: 'Landing Page', metadata: landingMetadata, expectedTitle: 'Undone > Turn Any Rabbit Hole & Video into Bite-Sized Learning Quests' },
    { name: 'Archives', metadata: archivesMetadata, expectedTitle: 'Undone > Archives' },
    { name: 'Events', metadata: eventsMetadata, expectedTitle: 'Undone > Events' },
    { name: 'Hall of Fame', metadata: hallOfFameMetadata, expectedTitle: 'Undone > Hall of Fame' },
    { name: 'New Quest', metadata: newQuestMetadata, expectedTitle: 'Undone > New Quest' },
    { name: 'Start Quest', metadata: startQuestMetadata, expectedTitle: 'Undone > Start Quest' },
    { name: 'Quest Draft', metadata: questDraftMetadata, expectedTitle: 'Undone > Quest Draft' },
    { name: 'Quest Builder', metadata: questBuildMetadata, expectedTitle: 'Undone > Quest Builder' },
  ];

  it.each(routeMetadatas)('formats $name correctly as $expectedTitle', ({ metadata, expectedTitle }) => {
    const resolved = resolveTitle(metadata.title);
    expect(resolved).toBe(expectedTitle);
    expect(resolved.startsWith('Undone > ')).toBe(true);

    // Ensure 'Undone' is never repeated in the title
    const undoneCount = (resolved.match(/Undone/g) || []).length;
    expect(undoneCount).toBe(1);

    // Ensure old pattern '| Undone' is absent
    expect(resolved).not.toContain('| Undone');
  });
});

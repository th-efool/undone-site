'use client';

import { EventsPage } from './components/EventsPage/EventsPage';
import type { Cohort } from '../../models';

interface EventsProps {
  cohortId: string;
  cohort: Cohort;
}

export function Events({ cohortId, cohort }: EventsProps) {
  const { events } = cohort;
  return <EventsPage events={events} />;
}

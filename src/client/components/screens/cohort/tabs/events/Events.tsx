import { useCohort } from '../../hooks';
import { EventsPage } from './components/EventsPage/EventsPage';

interface EventsProps {
  cohortId: string;
}

export function Events({ cohortId }: EventsProps) {
  const { events } = useCohort(cohortId);
  return <EventsPage events={events} />;
}

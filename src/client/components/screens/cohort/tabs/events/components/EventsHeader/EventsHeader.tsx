import type { CohortEvents } from '../../../../models';

export function EventsHeader({ events }: { events: CohortEvents }) {
  return (
    <header>
      <h2>{events.title}</h2>
      <p>{events.description}</p>
    </header>
  );
}

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ProcessingChecklist } from '../components/ProcessingChecklist';
import { readyFixture } from './ready.fixture';

afterEach(cleanup);
describe('saved processing checklist', () => {
  it('marks only saved work complete and identifies the current operation', () => {
    const snapshot = readyFixture(); snapshot.stage = 'processing'; snapshot.status = 'running';
    snapshot.processing!.phase = 'chunking'; snapshot.processing!.chunking!.complete = false;
    snapshot.processing!.analysis = null; snapshot.processing!.building = null;
    render(<ProcessingChecklist snapshot={snapshot} />);
    const list = screen.getByRole('list', { name: 'Saved processing stages' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map(item => item.getAttribute('data-state'))).toEqual(['complete', 'current', 'pending', 'pending']);
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[1].textContent).toContain('In progress');
  });
  it('never presents stale checkpoints as accepted completion', () => {
    const snapshot = readyFixture(); snapshot.inputRevision++;
    render(<ProcessingChecklist snapshot={snapshot} />);
    expect(screen.getAllByRole('listitem').every(item => item.getAttribute('data-state') === 'pending')).toBe(true);
  });
  it.each(['failed', 'canceled'] as const)('exposes %s without claiming completion', status => {
    const snapshot = readyFixture(); snapshot.status = status;
    snapshot.processing!.building!.complete = false;
    render(<ProcessingChecklist snapshot={snapshot} />);
    expect(screen.getAllByRole('listitem')[3].getAttribute('data-state')).toBe(status);
    expect(screen.getAllByRole('listitem')[3].textContent).toContain(status === 'failed' ? 'Failed' : 'Canceled');
  });
  it('requires the operation checkpoint to match the input revision', () => {
    const snapshot = readyFixture(); snapshot.processing!.checkpoint!.inputRevision--;
    render(<ProcessingChecklist snapshot={snapshot} />);
    expect(screen.getAllByRole('listitem')[0].getAttribute('data-state')).toBe('pending');
  });
});

import { describe, expect, it } from 'vitest';
import { MemoryInteractionRepository } from '../memory.repository';
import {
  planAgendaAction,
  type AgendaWorkspace,
} from './fixtures/agenda-domain';

const sampleAgenda: AgendaWorkspace = {
  schemaVersion: 1,
  meetingTitle: 'Engineering Sync',
  date: '2026-10-14',
  items: [
    {
      id: 'item-1',
      version: 0,
      title: 'Sprint Review',
      durationMinutes: 15,
      presenter: 'Alice',
      pinned: false,
    },
    {
      id: 'item-2',
      version: 0,
      title: 'Architecture Review',
      durationMinutes: 30,
      presenter: 'Bob',
      pinned: true,
    },
  ],
};

describe('Interaction Engine Portability (Agenda Domain Fixture)', () => {
  it('runs an independent agenda domain using the generic interaction repository', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = '2a7d4134-c7ee-45a8-9d89-6fa6eb932145';

    // 1. Create independent agenda workspace
    const ws = await repo.createWorkspace({
      id: wsId,
      ownerId: 'team-lead',
      domainId: 'agenda-builder',
      domainVersion: 1,
      initialSnapshot: sampleAgenda,
    });

    expect(ws.revision).toBe(0);
    expect(ws.snapshot.meetingTitle).toBe('Engineering Sync');

    // 2. Commit a title update action
    const envelope1 = {
      actionId: '809b5528-6d2c-47ea-bd32-ccbc1f81014a',
      workspaceId: wsId,
      expectedRevision: 0,
      entityVersions: [],
      action: { type: 'set_meeting_title', title: 'Q4 Strategic Planning' },
    };

    const res1 = await repo.commitAction<AgendaWorkspace>({
      workspaceId: wsId,
      ownerId: 'team-lead',
      expectedRevision: 0,
      envelope: envelope1,
      plan: planAgendaAction,
    });

    expect(res1.revision).toBe(1);
    expect(res1.state.meetingTitle).toBe('Q4 Strategic Planning');
    expect(res1.receipt.summary).toBe('Meeting title updated to "Q4 Strategic Planning".');

    // 3. Edit unpinned item
    const envelope2 = {
      actionId: '77c22e43-8515-4673-8cb9-f3089ce8646b',
      workspaceId: wsId,
      expectedRevision: 1,
      entityVersions: [{ kind: 'agenda_item', id: 'item-1', version: 0 }],
      action: { type: 'edit_item', itemId: 'item-1', durationMinutes: 20 },
    };

    const res2 = await repo.commitAction<AgendaWorkspace>({
      workspaceId: wsId,
      ownerId: 'team-lead',
      expectedRevision: 1,
      envelope: envelope2,
      plan: planAgendaAction,
    });

    expect(res2.revision).toBe(2);
    expect(res2.state.items.find(i => i.id === 'item-1')?.durationMinutes).toBe(20);
    expect(res2.receipt.changed[0]?.id).toBe('item-1');
    expect(res2.receipt.changed[0]?.version).toBe(1);

    // 4. Attempt to edit pinned item title -> rejected
    const envelope3 = {
      actionId: 'a29fa0d3-c0d1-4389-9851-f25fe7d8858a',
      workspaceId: wsId,
      expectedRevision: 2,
      entityVersions: [{ kind: 'agenda_item', id: 'item-2', version: 0 }],
      action: { type: 'edit_item', itemId: 'item-2', title: 'Overwritten Title' },
    };

    await expect(
      repo.commitAction<AgendaWorkspace>({
        workspaceId: wsId,
        ownerId: 'team-lead',
        expectedRevision: 2,
        envelope: envelope3,
        plan: planAgendaAction,
      })
    ).rejects.toThrow('PINNED_ITEM_PROTECTED');

    // 5. Query event timeline
    const events = await repo.queryEvents({
      workspaceId: wsId,
      ownerId: 'team-lead',
    });

    expect(events.length).toBe(2);
    expect(events[0]?.sequence).toBe(1);
    expect(events[1]?.sequence).toBe(2);
    expect(events[1]?.revision).toBe(2);
  });
});

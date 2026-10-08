import { z } from 'zod';
import {
  creationErrorSchema, creationSnapshotSchema, querySchema,
  recommendationResultSchema, startingPointSchema,
  type CreationSnapshot, type WorkspaceStage,
} from './contracts';

export const creationCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('request_recommendations'), query: querySchema, requestId: z.uuid() }),
  z.strictObject({ type: z.literal('create_own') }),
  z.strictObject({ type: z.literal('choose_starting_point'), startingPoint: startingPointSchema }),
  z.strictObject({ type: z.literal('back_to_recommendations') }),
]);
export type CreationCommand = z.infer<typeof creationCommandSchema>;
export const creationEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('recommendations_received'), result: recommendationResultSchema }),
  z.strictObject({ type: z.literal('operation_failed'), requestId: z.uuid(), error: creationErrorSchema }),
  z.strictObject({ type: z.literal('operation_cancelled'), requestId: z.uuid() }),
]);
export type CreationEvent = z.infer<typeof creationEventSchema>;

export function initialSnapshot(draftId: string): CreationSnapshot {
  return creationSnapshotSchema.parse({
    schemaVersion: 1, draftId, storage: 'tab_session', revision: 0, inputRevision: 0,
    stage: 'recommendations', query: '', status: 'idle', activeRequestId: null,
    result: null, startingPoint: null, error: null,
  });
}

export function canEnterStage(state: CreationSnapshot, stage: WorkspaceStage): boolean {
  if (stage === 'recommendations') return state.status !== 'running';
  if (stage === 'starting_point') return state.status === 'succeeded' && state.result !== null;
  // Later-stage orchestration is deliberately disabled at the 3A boundary.
  return false;
}

export function applyCommand(state: CreationSnapshot, input: CreationCommand): CreationSnapshot {
  const command = creationCommandSchema.parse(input);
  const changed = { ...state, revision: state.revision + 1, error: null };
  switch (command.type) {
    case 'request_recommendations':
      return creationSnapshotSchema.parse({
        ...changed, query: command.query, inputRevision: state.inputRevision + 1,
        stage: 'recommendations', status: 'running', activeRequestId: command.requestId,
        result: null, startingPoint: null,
      });
    case 'create_own':
      if (!canEnterStage(state, 'starting_point')) throw new Error('Intent is not ready');
      return creationSnapshotSchema.parse({ ...changed, stage: 'starting_point' });
    case 'choose_starting_point':
      if (state.stage !== 'starting_point' || state.status !== 'succeeded') throw new Error('Starting point is not available');
      return creationSnapshotSchema.parse({ ...changed, startingPoint: command.startingPoint });
    case 'back_to_recommendations':
      if (!canEnterStage(state, 'recommendations')) throw new Error('Operation is still running');
      return creationSnapshotSchema.parse({ ...changed, stage: 'recommendations' });
  }
}

export function applyEvent(state: CreationSnapshot, input: CreationEvent): CreationSnapshot {
  const event = creationEventSchema.parse(input);
  const requestId = event.type === 'recommendations_received' ? event.result.requestId : event.requestId;
  if (state.status !== 'running' || state.activeRequestId !== requestId) return state;
  if (event.type === 'recommendations_received' && (
    event.result.inputRevision !== state.inputRevision || event.result.intent.rawQuery !== state.query
  )) return state;
  const changed = { ...state, revision: state.revision + 1, activeRequestId: null };
  switch (event.type) {
    case 'recommendations_received':
      return creationSnapshotSchema.parse({ ...changed, status: 'succeeded', result: event.result, error: null });
    case 'operation_failed':
      return creationSnapshotSchema.parse({ ...changed, status: 'failed', error: event.error });
    case 'operation_cancelled':
      return creationSnapshotSchema.parse({ ...changed, status: 'canceled', error: null });
  }
}

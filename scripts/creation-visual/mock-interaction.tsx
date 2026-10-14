import React, { createContext, useContext } from 'react';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

export interface MockInteractionState {
  view: CohortWorkspace;
  revision: number;
  messages: any[];
}

export const MockInteractionContext = createContext<MockInteractionState>({
  view: null as any,
  revision: 1,
  messages: [],
});

export function InteractionProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useWorkspaceConnection() {
  return 'live' as const;
}

export function useInteractionState<T>() {
  const ctx = useContext(MockInteractionContext);
  return {
    view: ctx.view as T,
    revision: ctx.revision,
    pending: {},
    workspaceId: 'fixture-workspace',
    sequence: ctx.revision,
  };
}

export function useWorkspaceView<T>() {
  const ctx = useContext(MockInteractionContext);
  return ctx.view as T;
}

export function useWorkspaceMessages() {
  const ctx = useContext(MockInteractionContext);
  return ctx.messages;
}

export function useSendMessage() {
  return async () => true;
}

export function useDispatchAction() {
  return async () => true;
}

export function useAssistantActivity() {
  return { turns: [], unavailable: false };
}

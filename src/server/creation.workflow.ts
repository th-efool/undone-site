import { sleep } from 'workflow';
import { executeCreationSlice } from './creation.step';
import type { ExecutionScope } from './infrastructure/db/postgres/creationExecution.repo';

/** Queue sleeps survive request lifetimes; SQL owns all domain state and artifacts. */
export async function runDurableCreation(scope: ExecutionScope) {
  'use workflow';
  while (true) {
    const next = await executeCreationSlice(scope);
    if (next === null) return;
    await sleep(next);
  }
}

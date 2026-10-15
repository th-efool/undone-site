import { sleep } from 'workflow';
import { executeInteractionSlice } from './interaction.step';

export async function runDurableInteractionQueue(token: string) {
  'use workflow';
  while (await executeInteractionSlice(token)) await sleep(1_000);
}

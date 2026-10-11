import { describe, expect, it } from 'vitest';
import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import { modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { creationOutputSchema } from '../creationOutputSchema';
import { pedagogicalVectorSchema } from '@/src/shared/cohort-creation/pedagogical-vector';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';

const schema = z.strictObject({ groups: z.array(z.strictObject({ labels: z.array(z.string().min(1)).min(1).max(2) })).min(1).max(2) });
describe('Google structured output compatibility', () => {
  it('declares every required vector key as an explicit bounded property', async () => {
    const model = new MockLanguageModelV4({ provider: 'google.generative-ai' });
    const wire = await creationOutputSchema(pedagogicalVectorSchema, model).jsonSchema;
    expect(Object.keys(wire.properties ?? {})).toEqual([...PEDAGOGICAL_DIMENSIONS]);
    expect(wire.required).toEqual([...PEDAGOGICAL_DIMENSIONS]);
    expect(wire.additionalProperties).toBe(false);
    const valid = Object.fromEntries(PEDAGOGICAL_DIMENSIONS.map(key => [key, 0.5]));
    expect(pedagogicalVectorSchema.safeParse(valid).success).toBe(true);
    for (const invalid of [{ ...valid, cognitive_load: 2 }, { ...valid, cognitive_load: undefined }, { ...valid, invented: 0.5 }]) {
      expect(pedagogicalVectorSchema.safeParse(invalid).success).toBe(false);
    }
  });
  it('simplifies nested array upper bounds on the wire while retaining shape and lower bounds', async () => {
    const model = new MockLanguageModelV4({ provider: 'google.generative-ai', doGenerate: modelOutput({ groups: [{ labels: ['one'] }] }) });
    const result = await generateText({ model, prompt: 'Local test', output: Output.object({ schema: creationOutputSchema(schema, model) }) });
    expect(result.output).toEqual({ groups: [{ labels: ['one'] }] });
    const wire = JSON.stringify(model.doGenerateCalls[0].responseFormat);
    expect(wire).not.toContain('maxItems'); expect(wire).toContain('minItems'); expect(wire).toContain('additionalProperties');
  });
  it('still rejects oversized, empty and unexpected fields through the original Zod contract', async () => {
    for (const value of [{ groups: [{ labels: ['one', 'two', 'three'] }] }, { groups: [] }, { groups: [{ labels: ['one'], command: 'publish' }] }]) {
      const model = new MockLanguageModelV4({ provider: 'google.generative-ai', doGenerate: modelOutput(value) });
      await expect(generateText({ model, prompt: 'Local test', maxRetries: 0,
        output: Output.object({ schema: creationOutputSchema(schema, model) }) })).rejects.toSatisfy(NoObjectGeneratedError.isInstance);
    }
  });
  it('retains wire upper bounds for other providers', () => {
    const model = new MockLanguageModelV4();
    expect(JSON.stringify(creationOutputSchema(schema, model).jsonSchema)).toContain('maxItems');
  });
});

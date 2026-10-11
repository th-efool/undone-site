import { jsonSchema, zodSchema, type LanguageModel } from 'ai';
import { z } from 'zod';

/** Avoid Google's nested-array grammar expansion; application bounds stay authoritative. */
export function creationOutputSchema<T extends z.ZodType>(schema: T, model: LanguageModel) {
  const converted = zodSchema(schema);
  if (typeof model === 'string' || !model.provider.startsWith('google.')) return converted;
  const simplify = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(simplify);
    if (!value || typeof value !== 'object') return value;
    const node = value as Record<string, unknown>;
    return Object.fromEntries(Object.entries(node)
      .filter(([key]) => !(node.type === 'array' && key === 'maxItems'))
      .map(([key, child]) => [key, simplify(child)]));
  };
  return jsonSchema<z.output<T>>(simplify(converted.jsonSchema) as typeof converted.jsonSchema, {
    validate: async value => {
      const result = await schema.safeParseAsync(value);
      return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
    },
  });
}

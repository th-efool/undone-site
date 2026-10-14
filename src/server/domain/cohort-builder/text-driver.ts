/** Shared by HTTP commits and the supervised worker; unknown values fail closed. */
export function textDriver(env: NodeJS.ProcessEnv = process.env): 'snapshot' | 'durable' {
  const value = env.INTERACTION_TEXT_DRIVER ?? 'snapshot';
  if (value !== 'snapshot' && value !== 'durable') throw new Error('INVALID_TEXT_DRIVER');
  return value;
}

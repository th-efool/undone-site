/** Shared by HTTP commits and the supervised worker; unknown values fail closed. */
export function textDriver(env: { INTERACTION_TEXT_DRIVER?: string } = { INTERACTION_TEXT_DRIVER: process.env.INTERACTION_TEXT_DRIVER }): 'snapshot' | 'durable' {
  const value = env.INTERACTION_TEXT_DRIVER ?? 'snapshot';
  if (value !== 'snapshot' && value !== 'durable') throw new Error('INVALID_TEXT_DRIVER');
  return value;
}

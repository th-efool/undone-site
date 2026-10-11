/** Standard Hub keys take precedence; legacy deployments may retain their environment-specific pair. */
export function readCorsairConfig(env: NodeJS.ProcessEnv = process.env) {
  const legacyPrefix = env.NODE_ENV === 'production' ? 'CORSAIR_PROD' : 'CORSAIR_DEV';
  const standardKeys = Boolean(env.CORSAIR_API_KEY || env.CORSAIR_SIGNING_SECRET);
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing ${name} for Corsair Hub`);
    return value;
  };
  const kek = required('CORSAIR_KEK');
  if (!/^[a-f0-9]{64}$/i.test(kek) || /^0+$/.test(kek)) throw new Error('CORSAIR_KEK must be a nonzero 32-byte hex key');
  return {
    connectionString: required('DATABASE_URL'),
    kek,
    hub: {
      projectApiKey: required(standardKeys ? 'CORSAIR_API_KEY' : `${legacyPrefix}_API_KEY`),
      signingSecret: required(standardKeys ? 'CORSAIR_SIGNING_SECRET' : `${legacyPrefix}_SIGNING_SECRET`),
    },
  };
}

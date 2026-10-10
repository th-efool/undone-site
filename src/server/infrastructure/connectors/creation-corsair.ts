import 'server-only';
import { createCorsair } from 'corsair';
import { createCorsairDatabase } from 'corsair/db';
import { createHubConnectSession, respondToHubDeliveryFromRequest } from 'corsair/hub';
import { github } from '@corsair-dev/github';
import { notion } from '@corsair-dev/notion';
import { Pool } from 'pg';
import type { CreationConnectorGateway } from '@/src/server/domain/cohort-creation/connectors.service';

export const CREATION_CONNECTOR_SCHEMA = 'creation_connectors';
export const CREATION_CONNECTOR_DELIVERY_PATH = '/api/cohort-creation/connector-delivery';
export function creationConnectorConfig(env: NodeJS.ProcessEnv = process.env) {
  const required = (name: string) => { const value = env[name]?.trim(); if (!value) throw new Error('Creation connectors are not configured'); return value; };
  const origin = new URL(required('CREATION_CONNECTOR_ORIGIN'));
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
    (origin.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && origin.protocol === 'http:' && origin.hostname === 'localhost'))) {
    throw new Error('Invalid creation connector origin');
  }
  const kek = required('CREATION_CORSAIR_KEK');
  if (!/^[a-f0-9]{64}$/i.test(kek) || /^0+$/.test(kek)) throw new Error('Invalid creation connector encryption key');
  const projectApiKey = required('CREATION_CORSAIR_API_KEY');
  // Self-hosted Hub delivery is required; cloud mode has different storage semantics.
  if (!/^ck_(dev|prod)_/.test(projectApiKey)) throw new Error('Invalid creation connector project key');
  return {
    connectionString: env.DIRECT_URL?.trim() || required('DATABASE_URL'), kek, origin: origin.origin,
    hub: {
      projectApiKey, signingSecret: required('CREATION_CORSAIR_SIGNING_SECRET'),
      redirectURL: `${origin.origin}/quest/connections/return`,
      allowWorkflowExecution: false, tunnel: false,
    },
  };
}

function createRuntime() {
  const config = creationConnectorConfig();
  const pool = new Pool({ connectionString: config.connectionString, max: 4,
    connectionTimeoutMillis: 10_000, query_timeout: 15_000,
    options: `-c search_path=${CREATION_CONNECTOR_SCHEMA} -c timezone=UTC` });
  const database = createCorsairDatabase(pool).db.withSchema(CREATION_CONNECTOR_SCHEMA);
  const client = createCorsair({ database, kek: config.kek, multiTenancy: true, hub: config.hub,
    plugins: [github({ authType: 'managed' }), notion({ authType: 'managed' })] });
  const gateway: CreationConnectorGateway = {
    status: tenantId => client.manage.connectionStatus.get({ tenantId }),
    connect: async (tenantId, plugin) => {
      const session = await createHubConnectSession(client, { tenantId, plugin, oauthMode: 'managed',
        deliveryUrl: `${config.origin}${CREATION_CONNECTOR_DELIVERY_PATH}` });
      return { tenantId, connectUrl: session.connectUrl, expiresAt: session.expiresAt };
    },
    disconnect: (tenantId, plugin) => client.manage.disconnect({ tenantId, plugin }),
  };
  return { client, gateway, origin: config.origin };
}
let singleton: ReturnType<typeof createRuntime> | undefined;
export function creationCorsairRuntime() { return singleton ??= createRuntime(); }

export async function handleCreationConnectorDelivery(request: Request): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method) || new URL(request.url).pathname !== CREATION_CONNECTOR_DELIVERY_PATH) return new Response(null, { status: 404 });
  if (request.method === 'GET' && !new URL(request.url).searchParams.get('d')) return new Response(null, { status: 400 });
  try {
    // SDK supports signed POST delivery and signed browser-return GET delivery in development.
    // The delivery-only helper contains no management, tenant-list or arbitrary call routes.
    return await respondToHubDeliveryFromRequest(creationCorsairRuntime().client, request,
      { maxBodyBytes: 64 * 1024, bodyStallTimeoutMs: 5000 });
  }
  catch { return Response.json({ message: 'Connection delivery is unavailable.' }, { status: 503 }); }
}

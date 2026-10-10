import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { creationConnectionStatusSchema, creationConnectorSchema, type CreationConnector } from '@/src/shared/cohort-creation/connectors';
import type { DraftService } from './draft.service';

export function creationConnectorTenant(ownerId: string): string {
  if (!ownerId.trim() || ownerId.length > 1024) throw new Error('Invalid creation owner');
  return `creation_${createHash('sha256').update(JSON.stringify(['creation-owner-v1', ownerId])).digest('hex')}`;
}
export interface CreationConnectorGateway {
  status(tenantId: string): Promise<unknown>;
  connect(tenantId: string, plugin: CreationConnector): Promise<{ tenantId: string; connectUrl: string; expiresAt?: string }>;
  disconnect(tenantId: string, plugin: CreationConnector): Promise<{ ok: true; disconnected: boolean }>;
}
const connectResultSchema = z.object({ tenantId: z.string(), connectUrl: z.url(), expiresAt: z.string().optional() });
function validateProvider<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('Invalid connector response');
  return result.data;
}

export class CreationConnectorService {
  constructor(private readonly drafts: Pick<DraftService, 'load'>,
    private readonly gateway: () => CreationConnectorGateway) {}

  private async tenant(ownerId: string, draftId: string) {
    // The same owned durable draft read used by command APIs denies expired/foreign drafts.
    await this.drafts.load(ownerId, draftId);
    return creationConnectorTenant(ownerId);
  }
  async status(ownerId: string, draftId: string) {
    const tenant = await this.tenant(ownerId, draftId);
    const result = validateProvider(z.object({ github: z.unknown(), notion: z.unknown() }), await this.gateway().status(tenant));
    return validateProvider(creationConnectionStatusSchema, { github: result.github, notion: result.notion });
  }
  async connect(ownerId: string, draftId: string, provider: CreationConnector) {
    const plugin = creationConnectorSchema.parse(provider);
    const tenant = await this.tenant(ownerId, draftId);
    const result = validateProvider(connectResultSchema, await this.gateway().connect(tenant, plugin));
    const url = new URL(result.connectUrl);
    if (result.tenantId !== tenant || url.protocol !== 'https:' || url.hostname !== 'auth.corsair.dev' ||
      url.port || url.username || url.password) throw new Error('Invalid connector link');
    // Tenant identifiers and credentials never cross the application API boundary.
    return { connectUrl: url.href, ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}) };
  }
  async disconnect(ownerId: string, draftId: string, provider: CreationConnector) {
    const plugin = creationConnectorSchema.parse(provider);
    const tenant = await this.tenant(ownerId, draftId);
    return validateProvider(z.strictObject({ ok: z.literal(true), disconnected: z.boolean() }), await this.gateway().disconnect(tenant, plugin));
  }
}

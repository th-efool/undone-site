import 'server-only';
import { getHubConfig, getManagedAccessToken } from 'corsair/hub';
import { creationCorsairRuntime } from './creation-corsair';
import { creationConnectorTenant } from '@/src/server/domain/cohort-creation/connectors.service';
import { draftService } from '@/src/server/domain/cohort-creation/draft.runtime';
import type { CreationConnector } from '@/src/shared/cohort-creation/connectors';
import { creationConnectorSchema } from '@/src/shared/cohort-creation/connectors';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { GithubMaterialReader } from '@/src/server/domain/cohort-creation/materials/github';
import { GithubApiTransport } from '@/src/server/domain/cohort-creation/materials/github-public-api';

async function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort: () => void = () => undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    })]);
  } finally { signal.removeEventListener('abort', abort); }
}

/** Worker-only capability. Never accepts a browser tenant, token, material ID or shared credential fallback. */
export async function getOwnedCreationToken(scope: StorageScope, provider: CreationConnector, inputSignal?: AbortSignal): Promise<string> {
  const plugin = creationConnectorSchema.parse(provider);
  const signal = AbortSignal.any([...(inputSignal ? [inputSignal] : []), AbortSignal.timeout(30_000)]);
  signal.throwIfAborted();
  await cancellable(draftService.load(scope.ownerId, scope.draftId), signal);
  const tenant = creationConnectorTenant(scope.ownerId);
  const { client, gateway } = creationCorsairRuntime();
  const status = await cancellable(gateway.status(tenant), signal);
  if (!status || typeof status !== 'object' || !(plugin in status) || (status as Record<string, unknown>)[plugin] !== 'connected') {
    throw new CreationStorageError('INVALID_INPUT', `Connect your ${plugin === 'github' ? 'GitHub' : 'Notion'} account before acquiring private material.`);
  }
  signal.throwIfAborted();
  try {
    const account = client.withTenant(tenant);
    const result = await cancellable(getManagedAccessToken({ keys: account[plugin].keys,
      hub: getHubConfig(client), plugin, tenantId: tenant }), signal);
    signal.throwIfAborted();
    if (!result.accessToken || result.accessToken.length > 4096 || /[\u0000-\u0020\u007f]/.test(result.accessToken)) throw new Error('Invalid managed token');
    return result.accessToken;
  } catch {
    signal.throwIfAborted();
    throw new CreationStorageError('UNAVAILABLE', 'Your source connection could not be refreshed. Reconnect your account and retry.');
  }
}

export async function createOwnedGithubReader(scope: StorageScope, signal?: AbortSignal) {
  const token = await getOwnedCreationToken(scope, 'github', signal);
  return new GithubMaterialReader(new GithubApiTransport(fetch, token), 'connected');
}

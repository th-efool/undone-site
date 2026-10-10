import 'server-only';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationCorsairRuntime } from '@/src/server/infrastructure/connectors/creation-corsair';
import { draftService } from './draft.runtime';
import { CreationConnectorService } from './connectors.service';
import { creationConnectorHandler } from './connectors.http';

const service = new CreationConnectorService(draftService, () => creationCorsairRuntime().gateway);
export const handleCreationConnections = creationConnectorHandler(service, getCreationOwner, () => creationCorsairRuntime().origin);

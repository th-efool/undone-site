import { z } from 'zod';

export const creationConnectorSchema = z.enum(['github', 'notion']);
export type CreationConnector = z.infer<typeof creationConnectorSchema>;
export const connectorCommandSchema = z.strictObject({ plugin: creationConnectorSchema });
const connectionState = z.enum(['connected', 'missing_credentials', 'not_connected']);
export const creationConnectionStatusSchema = z.strictObject({ github: connectionState, notion: connectionState });
export type CreationConnectionStatus = z.infer<typeof creationConnectionStatusSchema>;

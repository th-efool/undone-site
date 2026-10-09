import 'server-only';
import { CreationArtifactRepository, MaterialBlobStore, reconcileCreationStorage } from './creation.store';
import { creationStorageMetadata } from './creation.metadata';
import { creationGridFS } from './creation.gridfs';
import { maintainCreationDrafts } from '@/src/server/domain/cohort-creation/retention';
import { creationRetentionRepo } from '../db/postgres/repositories/creationRetention.repo';

export const materialBlobStore = new MaterialBlobStore(creationStorageMetadata, creationGridFS);
export const creationArtifactRepository = new CreationArtifactRepository(creationStorageMetadata, creationGridFS);
export const reconcilePrivateCreationStorage = () => reconcileCreationStorage(creationStorageMetadata, creationGridFS);
export const maintainPrivateCreationStorage = () => maintainCreationDrafts(creationRetentionRepo, reconcilePrivateCreationStorage);

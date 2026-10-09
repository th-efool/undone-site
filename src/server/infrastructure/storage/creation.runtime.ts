import 'server-only';
import { CreationArtifactRepository, MaterialBlobStore, reconcileCreationStorage } from './creation.store';
import { creationStorageMetadata } from './creation.metadata';
import { creationGridFS } from './creation.gridfs';

export const materialBlobStore = new MaterialBlobStore(creationStorageMetadata, creationGridFS);
export const creationArtifactRepository = new CreationArtifactRepository(creationStorageMetadata, creationGridFS);
export const reconcilePrivateCreationStorage = () => reconcileCreationStorage(creationStorageMetadata, creationGridFS);

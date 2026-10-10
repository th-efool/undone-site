import type { useCreation } from '../hooks/useCreation';
import { StartingPoint } from './StartingPoint';
import { CreationConnections } from './CreationConnections';
import { TextMaterial } from './TextMaterial';
import { DiscoveryMaterials } from './DiscoveryMaterials';
import { UnderstandingProgress } from './UnderstandingProgress';

export function StartingWorkspace({ creation, draftId }: { creation: ReturnType<typeof useCreation>; draftId: string }) {
  const { snapshot } = creation;
  return <>
    <StartingPoint selected={snapshot.startingPoint} onSelect={creation.chooseStartingPoint} onBack={creation.back}
      disabled={creation.materialPending || snapshot.status === 'running'} />
    {snapshot.startingPoint === 'have_material' ? <><CreationConnections draftId={draftId} disabled={!creation.saved || creation.materialPending || snapshot.status === 'running'} />
      <TextMaterial snapshot={snapshot} uploading={creation.uploading} pending={creation.materialPending}
        onUpload={creation.uploadText} onCancelUpload={creation.cancelUpload} onCancel={creation.cancel} onRetry={creation.retryMaterial}
        onRemove={creation.removeMaterial} onWeb={creation.acquireWeb} onSelectUnits={creation.selectYoutubeUnits} onObserve={creation.observeYoutube} onGithub={creation.acquireGithub} onNotion={creation.acquireNotion} /></> :
      snapshot.startingPoint && <><DiscoveryMaterials snapshot={snapshot} disabled={!creation.saved || creation.materialPending}
        onFind={creation.discoverMaterial} onAcquire={creation.acquireDiscovered} onGithub={creation.acquireGithub} onCancel={creation.cancel} />
        {!!snapshot.materials.length && <TextMaterial snapshot={snapshot} uploading={false} pending={creation.materialPending} selectionOnly
          onUpload={creation.uploadText} onCancelUpload={creation.cancelUpload} onCancel={creation.cancel} onRetry={creation.retryMaterial}
          onRemove={creation.removeMaterial} onWeb={creation.acquireWeb} onSelectUnits={creation.selectYoutubeUnits} onObserve={creation.observeYoutube} onGithub={creation.acquireGithub} />}</>}
    {!!snapshot.materials.length && <UnderstandingProgress snapshot={snapshot} disabled={!creation.saved || creation.materialPending || snapshot.status === 'running'}
      onChunk={creation.chunkMaterial} onStart={creation.understandMaterial} onCancel={creation.cancel} onBack={creation.backToMaterials} />}
  </>;
}

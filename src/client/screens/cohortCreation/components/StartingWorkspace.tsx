import type { useCreation } from '../hooks/useCreation';
import { StartingPoint } from './StartingPoint';
import { CreationConnections } from './CreationConnections';
import { TextMaterial } from './TextMaterial';
import { DiscoveryMaterials } from './DiscoveryMaterials';
import { UnderstandingProgress } from './UnderstandingProgress';
import Image from 'next/image';
import styles from './MaterialWorkspace.module.css';

export function StartingWorkspace({ creation, draftId }: { creation: ReturnType<typeof useCreation>; draftId: string }) {
  const { snapshot } = creation;
  return <>
    <StartingPoint selected={snapshot.startingPoint} onSelect={creation.chooseStartingPoint} onBack={creation.back}
      compact={!!snapshot.startingPoint} disabled={creation.materialPending || snapshot.status === 'running'} />
    {snapshot.startingPoint && <div className={styles.workspace}>
      <div className={styles.decorations} aria-hidden="true">
        <span className={styles.photo}><Image src="/images/hero-collage/real-cathedral.jpg" alt="" fill sizes="220px" /></span>
        <span className={styles.note}>Same content.<br />More progress.</span>
        <span className={styles.books}><Image src="/images/hero-collage/real-mug-books.jpg" alt="" fill sizes="270px" /></span>
      </div>
    {snapshot.startingPoint === 'have_material' ? <>
      <TextMaterial snapshot={snapshot} uploading={creation.uploading} pending={creation.materialPending}
        onUpload={creation.uploadText} onCancelUpload={creation.cancelUpload} onCancel={creation.cancel} onRetry={creation.retryMaterial}
        onRemove={creation.removeMaterial} onWeb={creation.acquireWeb} onSelectUnits={creation.selectYoutubeUnits} onObserve={creation.observeYoutube} onGithub={creation.acquireGithub} onNotion={creation.acquireNotion} />
      <details className={styles.connections}><summary>Connected accounts</summary><CreationConnections draftId={draftId} disabled={!creation.saved || creation.materialPending || snapshot.status === 'running'} /></details></> :
      snapshot.startingPoint && <><DiscoveryMaterials snapshot={snapshot} disabled={!creation.saved || creation.materialPending}
        onFind={creation.discoverMaterial} onAcquire={creation.acquireDiscovered} onGithub={creation.acquireGithub} onCancel={creation.cancel} />
        {!!snapshot.materials.length && <TextMaterial snapshot={snapshot} uploading={false} pending={creation.materialPending} selectionOnly
          onUpload={creation.uploadText} onCancelUpload={creation.cancelUpload} onCancel={creation.cancel} onRetry={creation.retryMaterial}
          onRemove={creation.removeMaterial} onWeb={creation.acquireWeb} onSelectUnits={creation.selectYoutubeUnits} onObserve={creation.observeYoutube} onGithub={creation.acquireGithub} />}</>}
    {!!snapshot.materials.length && <UnderstandingProgress snapshot={snapshot} disabled={!creation.saved || creation.materialPending || snapshot.status === 'running'}
      onChunk={creation.chunkMaterial} onStart={creation.understandMaterial} onCancel={creation.cancel} onBack={creation.backToMaterials} />}
    </div>}
  </>;
}

export type ArtifactKind = 'intent' | 'discovery' | 'extraction' | 'concepts' | 'chunks' | 'analysis' | 'curriculum' | 'preview' | 'publication';
export type ChangeKind = 'metadata' | 'cover' | 'goal' | 'material' | 'chunk_strategy' | 'difficulty' | 'ordering' | 'visibility';

const dependencies: Record<ArtifactKind, readonly ArtifactKind[]> = {
  intent: ['discovery', 'concepts'], discovery: [],
  extraction: ['concepts', 'chunks'], concepts: ['analysis'],
  chunks: ['analysis'], analysis: ['curriculum'],
  curriculum: ['preview'], preview: ['publication'], publication: [],
};
const roots: Record<ChangeKind, readonly ArtifactKind[]> = {
  metadata: ['preview'], cover: ['preview'], goal: ['intent'],
  material: ['extraction'], chunk_strategy: ['chunks'],
  difficulty: ['analysis'], ordering: ['preview'], visibility: ['publication'],
};

// Caller scopes material changes to the affected source. This does not execute jobs.
export function invalidatedArtifacts(change: ChangeKind): ArtifactKind[] {
  const invalidated = new Set<ArtifactKind>();
  const visit = (artifact: ArtifactKind) => {
    if (invalidated.has(artifact)) return;
    invalidated.add(artifact);
    dependencies[artifact].forEach(visit);
  };
  roots[change].forEach(visit);
  return [...invalidated];
}

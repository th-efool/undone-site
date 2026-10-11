import { createHash } from 'node:crypto';
import { learningIntentSchema, type LearningIntent } from '@/src/shared/cohort-creation/contracts';
import { generatedGuideArtifactSchema, generatedGuideProposalSchema, GENERATED_GUIDE_VERSION, GENERATED_GUIDE_LIMITATION, renderGeneratedGuide,
  type GeneratedGuideProposal, type GeneratedGuideArtifact } from '@/src/shared/cohort-creation/generated-guide';
import { segmentRetainedText } from './materials/text';

export interface CreationGuideAuthor {
  readonly identity: GeneratedGuideArtifact['identity'];
  author(intent: LearningIntent, signal: AbortSignal): Promise<GeneratedGuideProposal>;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const generatedGuideIntentFingerprint = (intent: LearningIntent) => hash(learningIntentSchema.parse(intent));
export const generatedGuideFingerprint = (materialId: string, inputRevision: number, intent: LearningIntent) =>
  hash({ parserVersion: GENERATED_GUIDE_VERSION, materialId, inputRevision, intent: learningIntentSchema.parse(intent) });
export const generatedGuideVersion = (body: Pick<GeneratedGuideArtifact, 'materialId' | 'inputRevision' | 'intentFingerprint' | 'identity' | 'proposal'>) =>
  hash({ parserVersion: GENERATED_GUIDE_VERSION, materialId: body.materialId, inputRevision: body.inputRevision,
    intentFingerprint: body.intentFingerprint, identity: body.identity, proposal: body.proposal });

export function retainGeneratedGuide(materialId: string, inputRevision: number, intent: LearningIntent,
  identity: CreationGuideAuthor['identity'], output: unknown, signal?: AbortSignal): GeneratedGuideArtifact {
  signal?.throwIfAborted(); const proposal = generatedGuideProposalSchema.parse(output); const text = renderGeneratedGuide(proposal);
  const intentFingerprint = generatedGuideIntentFingerprint(intent);
  const version = generatedGuideVersion({ materialId, inputRevision, intentFingerprint, identity, proposal });
  return generatedGuideArtifactSchema.parse({ schemaVersion: 1, parserVersion: GENERATED_GUIDE_VERSION,
    materialId, unitId: materialId, intentId: intent.id, inputRevision, intentFingerprint, identity, version, proposal,
    extractionKind: 'generated_guide', contentOrigin: 'ai', offsetUnit: 'utf16', text, utf8ByteLength: Buffer.byteLength(text),
    segments: segmentRetainedText(text, materialId, materialId, version, signal),
    coverage: { scope: 'ai_authored_guide', exhaustive: false, limitations: [GENERATED_GUIDE_LIMITATION, ...proposal.limitations] } });
}

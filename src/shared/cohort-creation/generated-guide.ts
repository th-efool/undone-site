import { z } from 'zod';
import { sourceLocationSchema } from './contracts';

export const GENERATED_GUIDE_VERSION = 'generated-guide-v1';
export const GENERATED_GUIDE_LIMITS = { textBytes: 48 * 1024, sections: 8 } as const;
export const GENERATED_GUIDE_LIMITATION = 'AI-authored learning guide, not verified external source material. Check factual claims independently.';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const prose = (max: number) => z.string().trim().min(1).max(max).refine(value =>
  !/https?:\/\/|www\.|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/i.test(value),
  'Guide text cannot contain external links or binary control characters');
export const generatedGuideProposalSchema = z.strictObject({
  title: prose(200), sections: z.array(z.strictObject({ heading: prose(160), text: prose(4000) })).min(1).max(GENERATED_GUIDE_LIMITS.sections),
  limitations: z.array(prose(300)).min(1).max(8),
}).superRefine((proposal, ctx) => {
  const labels = proposal.sections.map(section => section.heading.normalize('NFKC').toLocaleLowerCase('en').trim());
  if (new Set(labels).size !== labels.length) ctx.addIssue({ code: 'custom', message: 'Guide section headings must be distinct' });
  if (new TextEncoder().encode(renderGeneratedGuide(proposal)).byteLength > GENERATED_GUIDE_LIMITS.textBytes) {
    ctx.addIssue({ code: 'custom', message: 'Guide exceeds 48 KiB; nothing was truncated' });
  }
});
export type GeneratedGuideProposal = z.infer<typeof generatedGuideProposalSchema>;
export function renderGeneratedGuide(proposal: GeneratedGuideProposal) {
  return `# ${proposal.title}\n\n${proposal.sections.map(section => `## ${section.heading}\n\n${section.text}`).join('\n\n')}\n`;
}
export const generatedGuideArtifactSchema = z.strictObject({
  schemaVersion: z.literal(1), parserVersion: z.literal(GENERATED_GUIDE_VERSION),
  materialId: z.uuid(), unitId: z.uuid(), intentId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  identity: z.strictObject({ provider: z.string().min(1).max(128), modelId: z.string().min(1).max(128), adapterVersion: z.string().min(1).max(128) }),
  intentFingerprint: hash, version: hash, proposal: generatedGuideProposalSchema,
  extractionKind: z.literal('generated_guide'), contentOrigin: z.literal('ai'), offsetUnit: z.literal('utf16'),
  text: z.string().min(1).max(GENERATED_GUIDE_LIMITS.textBytes), utf8ByteLength: z.number().int().positive().max(GENERATED_GUIDE_LIMITS.textBytes),
  segments: z.array(z.strictObject({ id: hash, kind: z.enum(['text', 'heading', 'code']), text: z.string().min(1).max(4096), location: sourceLocationSchema })).min(1).max(200),
  coverage: z.strictObject({ scope: z.literal('ai_authored_guide'), exhaustive: z.literal(false), limitations: z.array(z.string().min(1).max(500)).min(1).max(9) }),
}).superRefine((artifact, ctx) => {
  let cursor = 0; const ids = new Set<string>();
  for (const segment of artifact.segments) {
    const { anchor } = segment.location;
    if (anchor.kind !== 'text' || anchor.start !== cursor || artifact.text.slice(anchor.start, anchor.end) !== segment.text ||
      segment.id !== segment.location.segmentId || segment.location.materialId !== artifact.materialId ||
      segment.location.unitId !== artifact.unitId || ids.has(segment.id)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid generated guide segment provenance' }); return;
    }
    cursor = anchor.end; ids.add(segment.id);
  }
  if (artifact.unitId !== artifact.materialId || cursor !== artifact.text.length || artifact.text !== renderGeneratedGuide(artifact.proposal) ||
    new TextEncoder().encode(artifact.text).byteLength !== artifact.utf8ByteLength ||
    JSON.stringify(artifact.coverage.limitations) !== JSON.stringify([GENERATED_GUIDE_LIMITATION, ...artifact.proposal.limitations])) {
    ctx.addIssue({ code: 'custom', message: 'Incomplete generated guide or missing AI disclosure' });
  }
});
export type GeneratedGuideArtifact = z.infer<typeof generatedGuideArtifactSchema>;

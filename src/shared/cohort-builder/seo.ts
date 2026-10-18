import { z } from 'zod';
import type { CohortWorkspace } from './contracts';
import { deriveCohortDescription, deriveCohortTitle } from './cohort-metadata';

export const cohortSeoSchema = z.strictObject({
  version: z.literal(1),
  metaTitle: z.string().max(70),
  metaDescription: z.string().max(170),
  primaryKeyword: z.string().max(80),
  keywords: z.array(z.string().max(60)).max(16),
  concepts: z.array(z.string().max(80)).max(24),
  teaches: z.array(z.string().max(120)).max(12),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  timeRequired: z.string().regex(/^PT(\d+H)?(\d+M)?$/).optional(), // ISO-8601, e.g. PT2H30M
  outline: z.array(z.strictObject({ title: z.string().max(200), lessons: z.array(z.string().max(200)).max(60) })).max(30),
  keyMoments: z.array(z.strictObject({ name: z.string().max(120), startSeconds: z.number().int().nonnegative(), videoId: z.string().max(20).optional() })).max(12),
  faq: z.array(z.strictObject({ q: z.string().max(200), a: z.string().max(500) })).max(6),
  ogAlt: z.string().max(200),
});
export type CohortSeo = z.infer<typeof cohortSeoSchema>;

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[,:;\-\u2013\u2014]+$/, '') + '\u2026';
};
const uniq = (xs: string[]) => [...new Set(xs.map(x => x.trim()).filter(Boolean))];

export function toIsoDuration(totalMinutes: number): string {
  const m = Math.max(1, Math.round(totalMinutes));
  const h = Math.floor(m / 60), r = m % 60;
  return `PT${h ? `${h}H` : ''}${r || !h ? `${r}M` : ''}`;
}

/** Deterministic; safe to call after every pipeline stage (uses whatever data exists so far). */
export function buildCohortSeo(
  ws: Pick<CohortWorkspace, 'title' | 'intent' | 'sources' | 'understanding' | 'chunks' | 'analyses' | 'lessons' | 'dailyMinutes' | 'audience'>,
): CohortSeo {
  const title = deriveCohortTitle(ws);
  const concepts = uniq(ws.understanding.flatMap(u => u.topics)).slice(0, 24);
  const primaryKeyword = concepts[0] ?? title;
  const keywords = uniq([primaryKeyword, ...concepts.slice(1, 12), 'online course', 'structured learning', 'free']).slice(0, 16);
  const lessons = ws.lessons.filter(l => l.sourceChunkIds.length > 0);
  const minutes = lessons.length ? Math.max(5, lessons.length * Math.max(3, Math.round(ws.dailyMinutes / Math.max(1, lessons.length)))) : 0;

  const baseDesc = deriveCohortDescription(ws as never);
  const metaDescription = clip(
    `${baseDesc} ${lessons.length ? `${lessons.length} lessons.` : ''} Free on Undone.`, 160);

  const teaches = concepts.slice(0, 8).map(c => `Understand ${c}`);

  const outline = lessons.length
    ? [{ title: 'Curriculum', lessons: lessons.map(l => clip(l.title, 200)).slice(0, 60) }]
    : [];

  const keyMoments: CohortSeo['keyMoments'] = [];
  for (const src of ws.sources) {
    const videoId = src.provenance?.videoId;
    for (const loc of src.locations ?? []) {
      if (loc.startMs === undefined || keyMoments.length >= 12) continue;
      const chunk = ws.chunks.find(c => c.sourceId === src.id && c.start === loc.start);
      if (!chunk) continue;
      keyMoments.push({ name: clip(chunk.text.split(/(?<=[.!?])\s+/)[0] ?? src.label, 110), startSeconds: Math.floor(loc.startMs / 1000), videoId });
    }
  }

  const faq: CohortSeo['faq'] = [];
  if (concepts.length >= 2) faq.push({ q: `What will I learn in ${clip(title, 80)}?`, a: clip(`You will cover ${concepts.slice(0, 6).join(', ')}.`, 480) });
  if (lessons.length) faq.push({ q: 'How long does it take?', a: `About ${minutes} minutes of lessons, paced for ${ws.dailyMinutes} minutes a day.` });
  faq.push({ q: 'Is it free to join?', a: 'Yes. Public cohorts on Undone are free to explore and join.' });

  return {
    version: 1,
    metaTitle: clip(title, 60),
    metaDescription,
    primaryKeyword: clip(primaryKeyword, 80),
    keywords,
    concepts,
    teaches,
    timeRequired: minutes ? toIsoDuration(minutes) : undefined,
    outline,
    keyMoments,
    faq,
    ogAlt: clip(`${title} - cover image`, 190),
  };
}

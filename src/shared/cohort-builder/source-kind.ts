export type SourceKind = 'youtube' | 'github' | 'notion' | 'pdf' | 'web';

/** Single URL → source-kind classifier shared by composer UI, hook and routes. */
export function detectSourceKind(rawUrl: string): SourceKind {
  const url = rawUrl.toLowerCase().trim();
  if (/(^|[/.])(youtube\.com|youtu\.be)/.test(url)) return 'youtube';
  if (/notion\.(so|site)/.test(url)) return 'notion';
  if (/github\.com/.test(url)) return 'github';
  if (/\.pdf($|\?)/.test(url)) return 'pdf';
  return 'web';
}

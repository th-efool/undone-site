import { corsair } from '@/src/server/corsair';
import { type ImportPublishEvent, type ServerImportedSourceModel, type ServerImportedLessonModel } from '@/src/server/imports/youtube/youtube-import.service';

export interface ImportRequest {
  sourceId: string;
  title: string;
  url: string;
}

function toIsoDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatDuration(seconds: number) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${minutes}m`;
}

export async function importGitHubRepo(
  request: ImportRequest,
  publish: (event: ImportPublishEvent) => void,
  signal: AbortSignal,
): Promise<ServerImportedSourceModel> {
  publish({
    type: 'stage',
    stage: {
      id: 'extracting',
      title: 'Extracting GitHub Repo',
      description: 'Using Corsair to parse the GitHub repository.',
      status: 'running',
      progress: 50,
    },
  });

  const extraction = await (corsair as any).extract(request.url, { plugin: 'github' });
  if (!extraction) {
    throw new Error('Failed to extract GitHub repository data.');
  }

  const items = extraction.items || [];
  
  let totalSeconds = 0;
  
  const lessons: ServerImportedLessonModel[] = items.filter(Boolean).map((item: any, index: number) => {
    const wordCount = item.wordCount || (item.content ? item.content.split(/\s+/).length : 0);
    const durationSeconds = Math.max(60, Math.round((wordCount / 150) * 60));
    totalSeconds += durationSeconds;
    
    return {
      id: `${request.sourceId}-gh-${index}`,
      title: item.title || item.name || `File ${index + 1}`,
      thumbnail: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?q=80&w=1200&auto=format&fit=crop',
      description: item.description || '',
      duration: toIsoDuration(durationSeconds),
      position: index + 1,
      provider: 'GitHub',
      videoId: '',
      publishedLabel: 'GitHub Repo',
      sourceUrl: item.url || request.url,
    };
  });

  publish({
    type: 'stage',
    stage: {
      id: 'completed',
      title: 'Completed',
      description: 'The source is ready for the curriculum step.',
      status: 'completed',
      progress: 100,
    },
  });

  return {
    id: request.sourceId,
    title: extraction.title || request.title,
    description: extraction.description || '',
    thumbnail: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?q=80&w=1200&auto=format&fit=crop',
    provider: 'GitHub Repository',
    creator: extraction.author || 'GitHub User',
    lessonCount: lessons.length,
    totalDuration: formatDuration(totalSeconds),
    estimatedSeasonCount: Math.max(1, Math.ceil(lessons.length / 8)),
    status: 'completed',
    lessons,
  };
}

export type ChunkInterval = { start: number; end: number };

export class ChunkingService {
  semanticChunking(duration: number): ChunkInterval[] {
    if (duration <= 0) return [{ start: 0, end: 0 }];
    const intervals: ChunkInterval[] = [];
    for (let i = 0; i < duration; i += 60) {
      intervals.push({ start: i, end: Math.min(i + 60, duration) });
    }
    return intervals;
  }

  disabledChunking(duration: number): ChunkInterval[] {
    const validDuration = Math.max(0, duration);
    return [{ start: 0, end: validDuration }];
  }

  fixedIntervalChunking(duration: number): ChunkInterval[] {
    if (duration <= 0) return [{ start: 0, end: 0 }];
    const intervals: ChunkInterval[] = [];
    const intervalSize = 300;
    for (let i = 0; i < duration; i += intervalSize) {
      intervals.push({ start: i, end: Math.min(i + intervalSize, duration) });
    }
    return intervals;
  }

  applyChunkOverlap(intervals: ChunkInterval[], duration: number, fullText: string): string[] {
    if (!fullText) {
      return [''];
    }
    if (duration <= 0 || !intervals || intervals.length === 0) {
      return [fullText];
    }
    return intervals.map(interval => {
      const expandedStart = Math.max(0, Math.min(duration, interval.start - 20));
      const expandedEnd = Math.max(expandedStart, Math.min(duration, interval.end + 20));
      
      const startProportion = duration > 0 ? expandedStart / duration : 0;
      const endProportion = duration > 0 ? expandedEnd / duration : 1;
      
      const startIndex = Math.max(0, Math.min(fullText.length, Math.floor(startProportion * fullText.length)));
      const endIndex = Math.max(startIndex, Math.min(fullText.length, Math.ceil(endProportion * fullText.length)));
      
      return fullText.slice(startIndex, endIndex);
    });
  }
}

export const chunkingService = new ChunkingService();

export type ChunkInterval = { start: number; end: number };

export class ChunkingService {
  semanticChunking(duration: number): ChunkInterval[] {
    const intervals: ChunkInterval[] = [];
    for (let i = 0; i < duration; i += 60) {
      intervals.push({ start: i, end: Math.min(i + 60, duration) });
    }
    return intervals;
  }

  disabledChunking(duration: number): ChunkInterval[] {
    return [{ start: 0, end: duration }];
  }

  fixedIntervalChunking(duration: number): ChunkInterval[] {
    const intervals: ChunkInterval[] = [];
    const intervalSize = 300;
    for (let i = 0; i < duration; i += intervalSize) {
      intervals.push({ start: i, end: Math.min(i + intervalSize, duration) });
    }
    return intervals;
  }

  applyChunkOverlap(intervals: ChunkInterval[], duration: number, fullText: string): string[] {
    if (duration <= 0 || !fullText) {
      return [fullText];
    }
    return intervals.map(interval => {
      const expandedStart = Math.max(0, interval.start - 20);
      const expandedEnd = Math.min(duration, interval.end + 20);
      
      const startProportion = expandedStart / duration;
      const endProportion = expandedEnd / duration;
      
      const startIndex = Math.floor(startProportion * fullText.length);
      const endIndex = Math.floor(endProportion * fullText.length);
      
      return fullText.slice(startIndex, endIndex);
    });
  }
}

export const chunkingService = new ChunkingService();

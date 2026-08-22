import { GoogleGenerativeAI } from '@google/generative-ai';

export type ChunkInterval = { start: number; end: number };

export interface SemanticChunkResult {
  start: number;
  end: number;
  title?: string;
  summary?: string;
  text: string;
}

export class ChunkingService {
  private getClient(): GoogleGenerativeAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Intelligently decomposes educational text/transcript into topic-coherent semantic chunks using Gemini LLM,
   * falling back gracefully to heuristic linguistic segmentation.
   */
  async semanticChunkTranscript(
    text: string,
    duration: number,
    metadata?: { title?: string }
  ): Promise<SemanticChunkResult[]> {
    if (!text || text.trim().length === 0) {
      return [{ start: 0, end: Math.max(0, duration), text: '', title: metadata?.title || 'Part 1' }];
    }

    const validDuration = Math.max(0, duration);
    const client = this.getClient();

    if (client && text.length > 80) {
      try {
        const model = client.getGenerativeModel({
          model: 'gemini-3.6-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const prompt = `
You are an expert curriculum structuring AI for SideQuestHQ.
Analyze the following educational content/transcript and partition it into logical, atomic, self-contained semantic learning chunks.
Target duration per chunk is between 60 to 240 seconds (or 100 to 350 words).

METADATA:
Title: ${metadata?.title || 'Educational Lesson'}
Total Duration: ${validDuration}s

CONTENT:
"""
${text.slice(0, 30000)}
"""

OUTPUT FORMAT:
Return ONLY a valid JSON array of chunks matching this schema:
[
  {
    "title": "Clear descriptive sub-topic title",
    "summary": "1 sentence takeaway of this chunk",
    "approximatePercentageStart": 0,
    "approximatePercentageEnd": 35,
    "text": "Exact or cleanly extracted segment of text corresponding to this topic"
  }
]
`;

        const response = await model.generateContent(prompt);
        const parsed = JSON.parse(response.response.text());

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item, idx) => {
            const pStart = typeof item.approximatePercentageStart === 'number' 
              ? Math.max(0, Math.min(100, item.approximatePercentageStart)) 
              : (idx / parsed.length) * 100;
            const pEnd = typeof item.approximatePercentageEnd === 'number' 
              ? Math.max(pStart, Math.min(100, item.approximatePercentageEnd)) 
              : ((idx + 1) / parsed.length) * 100;
            
            const startSec = Math.round((pStart / 100) * validDuration);
            const endSec = Math.round((pEnd / 100) * validDuration);
            
            return {
              start: startSec,
              end: Math.max(startSec + 1, endSec),
              title: item.title || `Part ${idx + 1}`,
              summary: item.summary || '',
              text: item.text || text,
            };
          });
        }
      } catch (err) {
        console.warn('[ChunkingService] Gemini semantic chunking failed, falling back to heuristic:', err);
      }
    }

    try {
      return this.heuristicSemanticChunking(text, validDuration, metadata?.title);
    } catch (err) {
      console.warn('[ChunkingService] Heuristic chunking failed, defaulting to fixed interval chunking:', err);
      const intervals = this.fixedIntervalChunking(validDuration);
      const parts = this.applyChunkOverlap(intervals, validDuration, text);
      return intervals.map((interval, idx) => ({
        start: interval.start,
        end: interval.end,
        title: metadata?.title ? `${metadata.title} (Part ${idx + 1})` : `Part ${idx + 1}`,
        summary: '',
        text: parts[idx] || text,
      }));
    }
  }

  /**
   * Deterministic heuristic semantic chunking based on paragraphs, sentence boundaries, and word counts.
   */
  heuristicSemanticChunking(
    text: string,
    duration: number,
    baseTitle?: string
  ): SemanticChunkResult[] {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return [{ start: 0, end: duration, text: '', title: baseTitle || 'Part 1' }];
    }

    // Split by double newline (paragraphs) or sentences
    const rawParagraphs = cleanText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const units = rawParagraphs.length > 1 
      ? rawParagraphs 
      : cleanText.match(/[^.!?]+[.!?]+(\s|$)/g)?.map(s => s.trim()).filter(Boolean) || [cleanText];

    const targetWordsPerChunk = 180;
    const chunks: string[] = [];
    let currentChunk = '';

    for (const unit of units) {
      const prospective = currentChunk ? `${currentChunk}\n\n${unit}` : unit;
      const wordCount = prospective.split(/\s+/).length;

      if (wordCount > targetWordsPerChunk && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = unit;
      } else {
        currentChunk = prospective;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    if (chunks.length === 0) {
      chunks.push(cleanText);
    }

    const totalChunks = chunks.length;
    return chunks.map((chunkText, idx) => {
      const start = Math.round((idx / totalChunks) * duration);
      const end = Math.round(((idx + 1) / totalChunks) * duration);
      return {
        start,
        end: Math.max(start + 1, end),
        title: baseTitle ? `${baseTitle} (Part ${idx + 1})` : `Part ${idx + 1}`,
        summary: chunkText.slice(0, 100).trim() + (chunkText.length > 100 ? '...' : ''),
        text: chunkText,
      };
    });
  }

  semanticChunking(duration: number): ChunkInterval[] {
    if (duration <= 0) return [{ start: 0, end: 0 }];
    const intervals: ChunkInterval[] = [];
    for (let i = 0; i < duration; i += 120) {
      intervals.push({ start: i, end: Math.min(i + 120, duration) });
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


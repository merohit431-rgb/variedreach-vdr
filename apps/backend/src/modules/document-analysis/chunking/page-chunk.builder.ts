export interface ChunkSentenceInput {
  sentenceId: string;
  pageNumber: number;
  sequenceNumber: number;
  text: string;
  extractionMethod: 'NATIVE_TEXT' | 'OCR';
}

export interface PageChunk {
  chunkIndex: number;
  sentences: ChunkSentenceInput[];
}

// Rough, deliberately conservative token estimate (chars/4) -- good enough
// for a pre-call budget guard and a chunk-sizing heuristic, not meant to be
// exact. The real token count comes back from Claude's own response usage
// and is what's actually ledgered.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Groups consecutive pages' sentences into token-budgeted chunks for the
// Claude synthesis path. A chunk boundary always falls on a page boundary --
// a single page's sentences are never split across two chunks, since a
// page's extractionMethod (native vs. OCR) is a natural, meaningful grouping
// and splitting it mid-page buys nothing. If a single page's own sentences
// alone exceed maxInputTokens, that page still becomes its own one-page
// chunk rather than being dropped or truncated -- Claude's real 1M-token
// context window makes this edge case rare, but a conservative
// maxInputTokens configured well below that should never silently lose
// content as a result.
export function buildPageChunks(sentences: ChunkSentenceInput[], maxInputTokens: number): PageChunk[] {
  if (sentences.length === 0) return [];

  const byPage = new Map<number, ChunkSentenceInput[]>();
  for (const sentence of sentences) {
    const existing = byPage.get(sentence.pageNumber);
    if (existing) {
      existing.push(sentence);
    } else {
      byPage.set(sentence.pageNumber, [sentence]);
    }
  }
  const pageNumbers = Array.from(byPage.keys()).sort((a, b) => a - b);

  const chunks: PageChunk[] = [];
  let currentSentences: ChunkSentenceInput[] = [];
  let currentTokens = 0;

  for (const pageNumber of pageNumbers) {
    const pageSentences = byPage.get(pageNumber)!;
    const pageTokens = pageSentences.reduce((sum, s) => sum + estimateTokens(s.text), 0);

    if (currentSentences.length > 0 && currentTokens + pageTokens > maxInputTokens) {
      chunks.push({ chunkIndex: chunks.length, sentences: currentSentences });
      currentSentences = [];
      currentTokens = 0;
    }

    currentSentences.push(...pageSentences);
    currentTokens += pageTokens;
  }

  if (currentSentences.length > 0) {
    chunks.push({ chunkIndex: chunks.length, sentences: currentSentences });
  }

  return chunks;
}

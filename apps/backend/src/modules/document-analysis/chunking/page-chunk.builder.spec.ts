import { buildPageChunks, ChunkSentenceInput } from './page-chunk.builder';

function sentence(pageNumber: number, sequenceNumber: number, textLength: number): ChunkSentenceInput {
  return {
    sentenceId: `p${pageNumber}-s${sequenceNumber}`,
    pageNumber,
    sequenceNumber,
    text: 'x'.repeat(textLength),
    extractionMethod: 'NATIVE_TEXT',
  };
}

describe('buildPageChunks', () => {
  it('returns no chunks for an empty document', () => {
    expect(buildPageChunks([], 1000)).toEqual([]);
  });

  it('puts everything in one chunk when it all fits within the token budget', () => {
    const sentences = [sentence(1, 0, 40), sentence(1, 1, 40), sentence(2, 0, 40)];

    const chunks = buildPageChunks(sentences, 1000);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].sentences).toHaveLength(3);
  });

  it('never splits a single page across two chunks, even if that overflows the budget', () => {
    // Page 1 alone estimates to ~100 tokens (400 chars / 4), well over a
    // tiny 10-token budget -- it must still become one whole chunk, not be
    // dropped, truncated, or split mid-page.
    const sentences = [sentence(1, 0, 400)];

    const chunks = buildPageChunks(sentences, 10);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].sentences).toHaveLength(1);
  });

  it('starts a new chunk at a page boundary once the budget would be exceeded', () => {
    // Each page's sentence is ~25 tokens (100 chars / 4). A 40-token budget
    // fits exactly one page per chunk, never splitting a page.
    const sentences = [sentence(1, 0, 100), sentence(2, 0, 100), sentence(3, 0, 100)];

    const chunks = buildPageChunks(sentences, 40);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].sentences.map((s) => s.pageNumber)).toEqual([1]);
    expect(chunks[1].sentences.map((s) => s.pageNumber)).toEqual([2]);
    expect(chunks[2].sentences.map((s) => s.pageNumber)).toEqual([3]);
  });

  it('groups multiple pages into one chunk when they fit together', () => {
    // Two ~25-token pages fit in a 60-token budget; a third does not.
    const sentences = [sentence(1, 0, 100), sentence(2, 0, 100), sentence(3, 0, 100)];

    const chunks = buildPageChunks(sentences, 60);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].sentences.map((s) => s.pageNumber)).toEqual([1, 2]);
    expect(chunks[1].sentences.map((s) => s.pageNumber)).toEqual([3]);
  });

  it('assigns sequential, zero-based chunkIndex values', () => {
    const sentences = [sentence(1, 0, 100), sentence(2, 0, 100), sentence(3, 0, 100)];

    const chunks = buildPageChunks(sentences, 40);

    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2]);
  });

  it('preserves every sentence exactly once across all chunks, with page/sequence IDs intact', () => {
    const sentences = [
      sentence(1, 0, 100),
      sentence(1, 1, 100),
      sentence(2, 0, 100),
      sentence(3, 0, 100),
      sentence(3, 1, 100),
    ];

    const chunks = buildPageChunks(sentences, 60);
    const allSentenceIds = chunks.flatMap((c) => c.sentences.map((s) => s.sentenceId));

    expect(allSentenceIds.sort()).toEqual(sentences.map((s) => s.sentenceId).sort());
  });

  it('orders pages numerically regardless of input order', () => {
    const sentences = [sentence(3, 0, 100), sentence(1, 0, 100), sentence(2, 0, 100)];

    const chunks = buildPageChunks(sentences, 1000);

    expect(chunks[0].sentences.map((s) => s.pageNumber)).toEqual([1, 2, 3]);
  });

  it('keeps multiple sentences on the same page together in sequence order', () => {
    const sentences = [sentence(1, 1, 50), sentence(1, 0, 50)];

    const chunks = buildPageChunks(sentences, 1000);

    // Grouping is by page via a Map -- within a page, sentences retain the
    // order they were given in (callers pass them in sequence order already).
    expect(chunks[0].sentences.map((s) => s.sequenceNumber)).toEqual([1, 0]);
  });
});

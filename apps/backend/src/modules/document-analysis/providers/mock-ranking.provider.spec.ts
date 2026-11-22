import { SummarySectionType } from '@prisma/client';
import { MockRankingProvider } from './mock-ranking.provider';

describe('MockRankingProvider', () => {
  const provider = new MockRankingProvider();

  it('never returns sentence text -- only IDs, section type, rank, and score', async () => {
    const result = await provider.rank([
      { sentenceId: 's1', pageNumber: 1, text: 'The claim amount is Rs. 50,00,000 as per the agreement.' },
    ]);
    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(['rank', 'score', 'sectionType', 'sentenceId']);
    }
  });

  it('classifies a financial-figure sentence correctly', async () => {
    const result = await provider.rank([
      { sentenceId: 's1', pageNumber: 1, text: 'The claim amount is Rs. 50,00,000 as per the agreement schedule.' },
    ]);
    expect(result.find((r) => r.sentenceId === 's1')?.sectionType).toBe(SummarySectionType.FINANCIAL_FIGURES);
  });

  it('classifies a legal-provision sentence correctly', async () => {
    const result = await provider.rank([
      { sentenceId: 's1', pageNumber: 1, text: 'The Resolution Professional was appointed under Section 22 of the Code.' },
    ]);
    expect(result.find((r) => r.sentenceId === 's1')?.sectionType).toBe(SummarySectionType.LEGAL_PROVISIONS);
  });

  it('classifies a date/chronology sentence correctly', async () => {
    const result = await provider.rank([
      { sentenceId: 's1', pageNumber: 1, text: 'The application was admitted on 20 February 2026 by the tribunal.' },
    ]);
    expect(result.find((r) => r.sentenceId === 's1')?.sectionType).toBe(SummarySectionType.DATES_CHRONOLOGY);
  });

  it('falls back to OTHER_MATERIAL for a substantive sentence matching no category', async () => {
    const result = await provider.rank([
      { sentenceId: 's1', pageNumber: 1, text: 'The weather that day was unusually pleasant for the hearing.' },
    ]);
    expect(result.find((r) => r.sentenceId === 's1')?.sectionType).toBe(SummarySectionType.OTHER_MATERIAL);
  });

  it('excludes a too-short sentence (likely a header/footer fragment) from every category', async () => {
    const result = await provider.rank([{ sentenceId: 's1', pageNumber: 1, text: 'Page 1' }]);
    expect(result.find((r) => r.sentenceId === 's1')).toBeUndefined();
  });

  it('populates EXECUTIVE_OVERVIEW from the highest-scoring categorised sentences, alongside their own category', async () => {
    const sentences = [
      { sentenceId: 's1', pageNumber: 1, text: 'The claim amount is Rs. 50,00,000 as per the agreement schedule.' },
      { sentenceId: 's2', pageNumber: 1, text: 'The application was admitted on 20 February 2026 by the tribunal.' },
    ];
    const result = await provider.rank(sentences);

    const s1Entries = result.filter((r) => r.sentenceId === 's1');
    expect(s1Entries.map((e) => e.sectionType)).toEqual(
      expect.arrayContaining([SummarySectionType.FINANCIAL_FIGURES, SummarySectionType.EXECUTIVE_OVERVIEW]),
    );
  });

  it('assigns a dense, 1-based rank within each section, independent of global order', async () => {
    const sentences = [
      { sentenceId: 's1', pageNumber: 1, text: 'The claim amount is Rs. 50,00,000 as per the agreement schedule.' },
      { sentenceId: 's2', pageNumber: 1, text: 'The claim amount is Rs. 10,00,000 as per the second schedule.' },
    ];
    const result = await provider.rank(sentences);
    const financial = result.filter((r) => r.sectionType === SummarySectionType.FINANCIAL_FIGURES);
    expect(financial.map((r) => r.rank).sort()).toEqual([1, 2]);
  });

  it('is deterministic -- the same input always produces the same classification', async () => {
    const input = [{ sentenceId: 's1', pageNumber: 1, text: 'The claim amount is Rs. 50,00,000 as per the schedule.' }];
    const first = await provider.rank(input);
    const second = await provider.rank(input);
    expect(first).toEqual(second);
  });
});

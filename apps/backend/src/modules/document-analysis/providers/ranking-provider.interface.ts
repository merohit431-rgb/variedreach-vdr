import { SummarySectionType } from '@prisma/client';

export interface SentenceInput {
  sentenceId: string;
  pageNumber: number;
  text: string;
}

export interface RankedSentence {
  sentenceId: string;
  sectionType: SummarySectionType;
  rank: number;
  score: number;
}

export const RANKING_PROVIDER = 'RANKING_PROVIDER';

// Implementations never return sentence text -- only an ID, a section
// classification, and a score. The worker is the only place that ever
// resolves an ID back to real text, and only if that ID matches a row that
// already exists from the verified extraction pass (see
// DocumentAnalysisProcessor). A provider that is compromised, buggy, or
// actively adversarial can misclassify or omit sentences; it structurally
// cannot inject fabricated text, because this interface gives it nowhere to
// put any.
export interface SummaryRankingProvider {
  rank(sentences: SentenceInput[]): Promise<RankedSentence[]>;
}

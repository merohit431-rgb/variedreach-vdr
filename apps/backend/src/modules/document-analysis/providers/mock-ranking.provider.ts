import { Injectable } from '@nestjs/common';
import { SummarySectionType } from '@prisma/client';
import { RankedSentence, SentenceInput, SummaryRankingProvider } from './ranking-provider.interface';

// Deterministic, local, regex/keyword-based classification. This is
// genuinely NOT an AI or ML model -- no external call, no LLM, nothing to
// prompt-inject -- it is honest, transparent, rule-based pattern matching,
// shipped as the default and only active provider per "keep external
// provider integration disabled by default."
//
// Each rule is intentionally narrow and inspectable; a sentence can match
// more than one category, in which case the first (highest-priority) match
// wins -- category assignment is advisory/organisational, never a claim
// about the sentence's content beyond "it looked like it belonged here."
const CATEGORY_PATTERNS: Array<{ type: SummarySectionType; pattern: RegExp }> = [
  { type: SummarySectionType.FINANCIAL_FIGURES, pattern: /\b(rs\.?|inr|₹|\$|usd)\s?[\d,]+|\b\d[\d,]*\s?(lakh|crore|lakhs|crores)\b/i },
  { type: SummarySectionType.LEGAL_PROVISIONS, pattern: /\b(section|sec\.|regulation|rule|u\/s\.?)\s?\d|\bthe\s+code\b|\bthe\s+act\b/i },
  { type: SummarySectionType.DATES_CHRONOLOGY, pattern: /\b(\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}|dated|w\.e\.f\.)\b/i },
  { type: SummarySectionType.PARTIES, pattern: /\b(applicant|respondent|petitioner|appellant|opposite party|m\/s\.|resolution professional)\b/i },
  { type: SummarySectionType.PROCEEDINGS_ORDERS, pattern: /\b(tribunal|adjudicating authority|nclt|nclat|court|directed|order dated)\b/i },
  { type: SummarySectionType.FINDINGS_DECISIONS, pattern: /\b(held|found that|concluded|admitted|dismissed|allowed|rejected)\b/i },
  { type: SummarySectionType.RELIEF, pattern: /\b(relief|prayed|sought|granted|awarded)\b/i },
  { type: SummarySectionType.CLAIMS_LIABILITIES, pattern: /\b(claim|liability|liabilities|dues|outstanding amount|owed)\b/i },
];

// Below this, a sentence is almost certainly a page header/footer fragment
// or too thin to carry standalone meaning -- excluded from every category
// rather than forced into OTHER_MATERIAL.
const MIN_SUBSTANTIVE_LENGTH = 25;

@Injectable()
export class MockRankingProvider implements SummaryRankingProvider {
  async rank(sentences: SentenceInput[]): Promise<RankedSentence[]> {
    const ranked: RankedSentence[] = [];
    const overviewCandidates: Array<{ sentenceId: string; score: number }> = [];

    for (const sentence of sentences) {
      if (sentence.text.length < MIN_SUBSTANTIVE_LENGTH) continue;

      const match = CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(sentence.text));
      const sectionType = match?.type ?? SummarySectionType.OTHER_MATERIAL;
      // A matched, specific category scores higher than the OTHER_MATERIAL
      // catch-all; longer sentences within a category score marginally
      // higher, as a proxy for "carries more content" -- deliberately crude,
      // deliberately inspectable, not dressed up as anything more.
      const score = (match ? 0.6 : 0.2) + Math.min(sentence.text.length / 1000, 0.3);

      ranked.push({ sentenceId: sentence.sentenceId, sectionType, rank: 0, score });
      if (match) {
        overviewCandidates.push({ sentenceId: sentence.sentenceId, score });
      }
    }

    // Executive overview: the highest-scoring categorised sentences overall,
    // duplicated into that section alongside their original category --
    // SummarySentenceReference's unique constraint is per-section, so the
    // same sentence can legitimately appear in both its own category and the
    // overview.
    overviewCandidates.sort((a, b) => b.score - a.score);
    for (const candidate of overviewCandidates.slice(0, 5)) {
      ranked.push({
        sentenceId: candidate.sentenceId,
        sectionType: SummarySectionType.EXECUTIVE_OVERVIEW,
        rank: 0,
        score: candidate.score,
      });
    }

    // Assign final per-section rank now that every candidate for every
    // section is known.
    const bySection = new Map<SummarySectionType, RankedSentence[]>();
    for (const item of ranked) {
      const list = bySection.get(item.sectionType) ?? [];
      list.push(item);
      bySection.set(item.sectionType, list);
    }
    for (const list of bySection.values()) {
      list.sort((a, b) => b.score - a.score);
      list.forEach((item, index) => {
        item.rank = index + 1;
      });
    }

    return ranked;
  }
}

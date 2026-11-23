import { Injectable } from '@nestjs/common';
import { StatementVerificationStatus } from '@prisma/client';

export interface CheckedToken {
  type: 'CURRENCY' | 'DATE' | 'PROPER_NOUN' | 'SECTION_REFERENCE';
  value: string;
  matched: boolean;
}

export interface VerificationResult {
  status: StatementVerificationStatus;
  details: { checkedTokens: CheckedToken[]; overlapScore?: number };
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const LAKH = 100_000;
const CRORE = 10_000_000;

// Everything below is deliberately crude, regex-based, and inspectable --
// the same taste as MockRankingProvider's own category patterns, not a
// second opaque LLM call. The Phase 3C brief is explicit that Claude's own
// self-reported confidence must never be trusted as proof; a verification
// mechanism that was itself another model call would just move the
// trust problem one step sideways rather than solving it.

// Extracts a currency/amount token and normalizes it to a canonical number
// so cosmetic reformatting (Claude restating "₹25,00,000" as "Rs. 25 lakh")
// still matches on the underlying value rather than failing on presentation.
//
// Word-multiplier matches (wordPattern) are found first and their spans
// recorded; symbolPattern matches whose digit group falls inside one of
// those spans are then dropped. This two-pass, position-based approach is
// deliberate: an inline negative lookahead here (tried first, see git
// history) let the regex engine backtrack the optional decimal group just
// far enough to dodge the lookahead, silently truncating "Rs. 2.4 crore"'s
// captured digits to "2" instead of rejecting the match outright.
function extractCurrencyTokens(text: string): Array<{ raw: string; value: number }> {
  const tokens: Array<{ raw: string; value: number }> = [];

  const wordPattern = /([\d,]+(?:\.\d+)?)\s?(lakh|crore|lakhs|crores|million|billion)\b/gi;
  const wordMatchSpans: Array<[number, number]> = [];
  for (const match of text.matchAll(wordPattern)) {
    const base = parseFloat(match[1].replace(/,/g, ''));
    if (Number.isNaN(base)) continue;
    const unit = match[2].toLowerCase();
    const multiplier = unit.startsWith('lakh') ? LAKH : unit.startsWith('crore') ? CRORE : unit === 'million' ? 1_000_000 : 1_000_000_000;
    tokens.push({ raw: match[0], value: base * multiplier });
    wordMatchSpans.push([match.index!, match.index! + match[0].length]);
  }

  const symbolPattern = /(?:₹|rs\.?|inr|usd|\$)\s?([\d,]+(?:\.\d+)?)/gi;
  for (const match of text.matchAll(symbolPattern)) {
    const digitsStart = match.index! + match[0].length - match[1].length;
    const overlapsWordMatch = wordMatchSpans.some(([start, end]) => digitsStart >= start && digitsStart < end);
    if (overlapsWordMatch) continue;

    const value = parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isNaN(value)) tokens.push({ raw: match[0], value });
  }

  return tokens;
}

// Normalizes several common date formats to a {day, month, year} tuple so
// "12 March 2023" / "12/03/2023" / "2023-03-12" are comparable regardless of
// which format the source or the statement happens to use.
function extractDateTokens(text: string): Array<{ raw: string; day: number; month: number; year: number }> {
  const tokens: Array<{ raw: string; day: number; month: number; year: number }> = [];

  const namedMonthPattern = /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?,?\s+(\d{4})\b/gi;
  for (const match of text.matchAll(namedMonthPattern)) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month) tokens.push({ raw: match[0], day: parseInt(match[1], 10), month, year: parseInt(match[3], 10) });
  }

  const isoPattern = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  for (const match of text.matchAll(isoPattern)) {
    tokens.push({ raw: match[0], year: parseInt(match[1], 10), month: parseInt(match[2], 10), day: parseInt(match[3], 10) });
  }

  const slashPattern = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  for (const match of text.matchAll(slashPattern)) {
    // Ambiguous DD/MM vs MM/DD -- stored as given rather than guessed, since
    // the comparison below checks both fields match literally, not a
    // resolved calendar date.
    tokens.push({ raw: match[0], day: parseInt(match[1], 10), month: parseInt(match[2], 10), year: parseInt(match[3], 10) });
  }

  return tokens;
}

// Sequences of 2+ consecutive capitalized words -- e.g. "Resolution
// Professional", "ABC Projects Pvt Ltd". Deliberately the crudest of the
// four token types: documented as a real limitation, not oversold as
// precise, since proper-noun extraction without real NLP is inherently
// approximate.
function extractProperNounTokens(text: string): string[] {
  const pattern = /\b(?:[A-Z][a-zA-Z'.]*\s+){1,5}[A-Z][a-zA-Z'.]*\b/g;
  const matches: string[] = text.match(pattern) ?? [];
  return matches.filter((m) => m.trim().split(/\s+/).length >= 2);
}

// Mirrors MockRankingProvider's own LEGAL_PROVISIONS category pattern.
function extractSectionReferenceTokens(text: string): string[] {
  const pattern = /\b(?:section|sec\.|regulation|rule|u\/s\.?)\s?\d+(?:\(\d+\))?/gi;
  return text.match(pattern) ?? [];
}

function normalizeForOverlap(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3), // short/stop words add noise, not signal
  );
}

function wordOverlapScore(a: string, b: string): number {
  const wordsA = normalizeForOverlap(a);
  if (wordsA.size === 0) return 0;
  const wordsB = normalizeForOverlap(b);
  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1;
  }
  return shared / wordsA.size;
}

const QUALITATIVE_OVERLAP_THRESHOLD = 0.5;

@Injectable()
export class StatementVerificationService {
  // Verifies one Claude-written statement against the text of the sentences
  // it cited (already resolved to real, in-chunk ExtractedSentence rows by
  // the caller -- this method never touches the database and never decides
  // whether a citedSentenceId itself is real; that check happens earlier,
  // in ClaudeSynthesisService, before a statement ever reaches here).
  verify(statementText: string, citedSentenceTexts: string[]): VerificationResult {
    const evidencePool = citedSentenceTexts.join(' ');

    const currencyTokens = extractCurrencyTokens(statementText);
    const dateTokens = extractDateTokens(statementText);
    const properNouns = extractProperNounTokens(statementText);
    const sectionRefs = extractSectionReferenceTokens(statementText);

    const checkedTokens: CheckedToken[] = [];

    for (const token of currencyTokens) {
      const poolAmounts = extractCurrencyTokens(evidencePool);
      const matched = poolAmounts.some((p) => Math.abs(p.value - token.value) < 0.01);
      checkedTokens.push({ type: 'CURRENCY', value: token.raw, matched });
    }

    for (const token of dateTokens) {
      const poolDates = extractDateTokens(evidencePool);
      const matched = poolDates.some((p) => p.day === token.day && p.month === token.month && p.year === token.year);
      checkedTokens.push({ type: 'DATE', value: token.raw, matched });
    }

    for (const name of properNouns) {
      const matched = evidencePool.toLowerCase().includes(name.toLowerCase());
      checkedTokens.push({ type: 'PROPER_NOUN', value: name, matched });
    }

    for (const ref of sectionRefs) {
      const normalizedRef = ref.toLowerCase().replace(/\s+/g, '');
      const matched = evidencePool.toLowerCase().replace(/\s+/g, '').includes(normalizedRef);
      checkedTokens.push({ type: 'SECTION_REFERENCE', value: ref, matched });
    }

    if (checkedTokens.length === 0) {
      // No hard fact to check -- fall back to a text-overlap similarity
      // score between the statement and its evidence pool, so a wildly
      // mismatched citation is still caught even for a purely qualitative
      // statement.
      const overlapScore = wordOverlapScore(statementText, evidencePool);
      return {
        status: overlapScore >= QUALITATIVE_OVERLAP_THRESHOLD ? StatementVerificationStatus.VERIFIED : StatementVerificationStatus.UNVERIFIED,
        details: { checkedTokens: [], overlapScore },
      };
    }

    const matchedCount = checkedTokens.filter((t) => t.matched).length;
    const status =
      matchedCount === checkedTokens.length
        ? StatementVerificationStatus.VERIFIED
        : matchedCount > 0
          ? StatementVerificationStatus.PARTIALLY_VERIFIED
          : StatementVerificationStatus.UNVERIFIED;

    return { status, details: { checkedTokens } };
  }
}

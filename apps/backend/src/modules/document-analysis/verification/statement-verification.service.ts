import { Injectable } from '@nestjs/common';
import { StatementVerificationStatus } from '@prisma/client';

export interface CitationInput {
  sentenceId: string;
  pageNumber: number;
  text: string;
}

export interface CheckedToken {
  type: 'CURRENCY' | 'DATE' | 'PROPER_NOUN' | 'SECTION_REFERENCE' | 'PERCENTAGE';
  value: string;
  matched: boolean;
}

export interface ConflictPassage {
  sentenceId: string;
  pageNumber: number;
  value: string;
  text: string;
}

export interface ConflictDetail {
  type: CheckedToken['type'];
  statementValue: string;
  passages: ConflictPassage[];
}

export interface VerificationResult {
  status: StatementVerificationStatus;
  details: { checkedTokens: CheckedToken[]; overlapScore?: number; conflicts?: ConflictDetail[] };
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

interface CurrencyToken { raw: string; value: number }
interface DateToken { raw: string; day: number; month: number; year: number }
interface PercentageToken { raw: string; value: number }

// Word-multiplier matches (wordPattern) are found first and their spans
// recorded; symbolPattern matches whose digit group falls inside one of
// those spans are then dropped. This two-pass, position-based approach is
// deliberate: an inline negative lookahead here (tried first, see git
// history) let the regex engine backtrack the optional decimal group just
// far enough to dodge the lookahead, silently truncating "Rs. 2.4 crore"'s
// captured digits to "2" instead of rejecting the match outright.
function extractCurrencyTokens(text: string): CurrencyToken[] {
  const tokens: CurrencyToken[] = [];

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
function extractDateTokens(text: string): DateToken[] {
  const tokens: DateToken[] = [];

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

// "91%" / "91 per cent" / "91 percent" -- normalized to a plain number so
// cosmetic spelling differences don't false-fail, same spirit as currency.
function extractPercentageTokens(text: string): PercentageToken[] {
  const tokens: PercentageToken[] = [];
  // \b after the literal "%" would never match (both sides are non-word
  // characters, so there is no boundary there at all) -- found via a real
  // failing test, not spotted by inspection. Only the word-based
  // alternatives ("per cent"/"percent") need \b to avoid matching inside a
  // longer word; "%" is already unambiguous without one.
  const pattern = /(\d+(?:\.\d+)?)\s?(?:%|per\s?cent\b|percent\b)/gi;
  for (const match of text.matchAll(pattern)) {
    const value = parseFloat(match[1]);
    if (!Number.isNaN(value)) tokens.push({ raw: match[0], value });
  }
  return tokens;
}

// Sequences of 2+ consecutive capitalized words -- e.g. "Resolution
// Professional", "ABC Projects Pvt Ltd". Deliberately the crudest of the
// token types: documented as a real limitation, not oversold as precise,
// since proper-noun extraction without real NLP is inherently approximate.
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

function currencyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}
function dateEqual(a: DateToken, b: DateToken): boolean {
  return a.day === b.day && a.month === b.month && a.year === b.year;
}
function percentageEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}
function textEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
function sectionRefEqual(a: string, b: string): boolean {
  return a.toLowerCase().replace(/\s+/g, '') === b.toLowerCase().replace(/\s+/g, '');
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

// One extractor + equality check per type, used identically for (a) pooling
// every citation's tokens to check what the statement claims, and (b)
// comparing citations against EACH OTHER to detect disagreement. Keeping
// both uses on the exact same extraction/equality logic is what guarantees
// "the citations disagree" and "the statement matches one of them" can
// never silently diverge into inconsistent readings of the same text.
interface TypeHandler<T> {
  type: CheckedToken['type'];
  extract: (text: string) => T[];
  equal: (a: T, b: T) => boolean;
  render: (t: T) => string;
}

const HANDLERS: Array<TypeHandler<unknown>> = [
  { type: 'CURRENCY', extract: extractCurrencyTokens, equal: (a, b) => currencyEqual((a as CurrencyToken).value, (b as CurrencyToken).value), render: (t) => (t as CurrencyToken).raw } as TypeHandler<CurrencyToken>,
  { type: 'DATE', extract: extractDateTokens, equal: (a, b) => dateEqual(a as DateToken, b as DateToken), render: (t) => (t as DateToken).raw } as TypeHandler<DateToken>,
  { type: 'PERCENTAGE', extract: extractPercentageTokens, equal: (a, b) => percentageEqual((a as PercentageToken).value, (b as PercentageToken).value), render: (t) => (t as PercentageToken).raw } as TypeHandler<PercentageToken>,
  { type: 'PROPER_NOUN', extract: extractProperNounTokens, equal: (a, b) => textEqual(a as string, b as string), render: (t) => t as string } as TypeHandler<string>,
  { type: 'SECTION_REFERENCE', extract: extractSectionReferenceTokens, equal: (a, b) => sectionRefEqual(a as string, b as string), render: (t) => t as string } as TypeHandler<string>,
] as unknown as Array<TypeHandler<unknown>>;

@Injectable()
export class StatementVerificationService {
  // Verifies one Claude-written statement against the text of the sentences
  // it cited. Citations are the already-resolved, real, in-chunk
  // ExtractedSentence rows the caller validated (ClaudeSynthesisService) --
  // this method never touches the database and never decides whether a
  // citedSentenceId itself is real; that check happens earlier, before a
  // statement ever reaches here.
  //
  // Two independent passes over the same citations:
  //  1. Presence check (as before): does a token the STATEMENT asserts
  //     appear somewhere across the combined citations? A fact legitimately
  //     split across two citations (one gives the date, another the
  //     amount) still verifies here -- that is correct, not a bug.
  //  2. Conflict check (new): for every type the statement actually
  //     asserts a value for, are the CITATIONS' OWN values for that type
  //     mutually consistent, checked independently per citation? If two
  //     citations disagree with each other, the statement is never allowed
  //     to be VERIFIED merely because its own figure happens to match one
  //     of them -- it is CONFLICTING_SOURCE instead, with both disagreeing
  //     passages (and their page numbers) surfaced, never silently resolved.
  verify(statementText: string, citations: CitationInput[]): VerificationResult {
    const evidencePool = citations.map((c) => c.text).join(' ');
    const checkedTokens: CheckedToken[] = [];
    const conflicts: ConflictDetail[] = [];

    for (const handler of HANDLERS) {
      const statementTokens = handler.extract(statementText);
      if (statementTokens.length === 0) continue; // this statement makes no claim of this type -- nothing to check or conflict on

      // Pass 1 -- presence, against the pooled text (unchanged behavior).
      const poolTokens = handler.extract(evidencePool);
      for (const token of statementTokens) {
        const matched = poolTokens.some((p) => handler.equal(p, token));
        checkedTokens.push({ type: handler.type, value: handler.render(token), matched });
      }

      // Pass 2 -- do the CITATIONS disagree with each other on this type,
      // independent of what the statement claims? Each citation's tokens
      // are extracted from that citation ALONE, never pooled, so one
      // citation's text can never contaminate another's.
      const perCitation = citations.map((c) => ({ citation: c, tokens: handler.extract(c.text) }));
      const distinctGroups: Array<{ sample: unknown; members: typeof perCitation }> = [];
      for (const entry of perCitation) {
        for (const token of entry.tokens) {
          const group = distinctGroups.find((g) => handler.equal(g.sample, token));
          if (group) {
            if (!group.members.includes(entry)) group.members.push(entry);
          } else {
            distinctGroups.push({ sample: token, members: [entry] });
          }
        }
      }

      // Require the disagreement to span 2+ DIFFERENT citations, not just
      // 2+ values that both happen to sit inside the same one sentence --
      // a single citation mentioning two different same-type figures (e.g.
      // "the principal was X and the penalty was Y") is two different
      // facts, not a contradiction, and must never be reported as one.
      const distinctSentenceIds = new Set(distinctGroups.flatMap((g) => g.members.map((m) => m.citation.sentenceId)));

      if (distinctGroups.length >= 2 && distinctSentenceIds.size >= 2) {
        // The citations contain 2+ mutually distinct values of a type this
        // statement actually makes a claim about -- report the conflict
        // rather than letting pass-1's presence match stand unqualified.
        const passages: ConflictPassage[] = [];
        for (const group of distinctGroups) {
          for (const entry of group.members) {
            passages.push({
              sentenceId: entry.citation.sentenceId,
              pageNumber: entry.citation.pageNumber,
              value: handler.render(group.sample as never),
              text: entry.citation.text,
            });
          }
        }
        conflicts.push({ type: handler.type, statementValue: statementTokens.map((t) => handler.render(t)).join(', '), passages });
      }
    }

    if (conflicts.length > 0) {
      return { status: StatementVerificationStatus.CONFLICTING_SOURCE, details: { checkedTokens, conflicts } };
    }

    if (checkedTokens.length === 0) {
      // No hard fact to check -- fall back to a text-overlap similarity
      // score between the statement and its evidence pool, so a wildly
      // mismatched citation is still caught even for a purely qualitative
      // statement.
      const overlapScore = wordOverlapScore(statementText, evidencePool);
      return {
        status: overlapScore >= QUALITATIVE_OVERLAP_THRESHOLD ? StatementVerificationStatus.VERIFIED : StatementVerificationStatus.UNSUPPORTED,
        details: { checkedTokens: [], overlapScore },
      };
    }

    const matchedCount = checkedTokens.filter((t) => t.matched).length;
    const status =
      matchedCount === checkedTokens.length
        ? StatementVerificationStatus.VERIFIED
        : matchedCount > 0
          ? StatementVerificationStatus.PARTIALLY_SUPPORTED
          : StatementVerificationStatus.UNSUPPORTED;

    return { status, details: { checkedTokens } };
  }
}

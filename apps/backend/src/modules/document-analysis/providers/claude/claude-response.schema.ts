import { SummarySectionType } from '@prisma/client';

// Passed as output_config.format.schema. Per Anthropic's documented
// constraints on this feature: no recursive schemas, no oneOf/not, and no
// minimum/maximum keywords -- numeric/length bounds are described in prose
// instead (see statementText's description below) since the constrained
// decoder doesn't enforce them directly.
//
// Deliberately no confidence field anywhere in this schema: the Phase 3C
// brief is explicit that Claude's self-reported confidence must never be
// trusted as proof. The only confidence number anywhere in this feature is
// Tesseract's own independently-measured OCR confidence (ExtractedPage.
// ocrConfidence) -- nothing here lets Claude report one for its own output.
export const CHUNK_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    statements: {
      type: 'array',
      description:
        'Each item is one synthesized factual statement, kept under 400 characters, grounded only in the sentences provided in this chunk.',
      items: {
        type: 'object',
        properties: {
          sectionType: {
            type: 'string',
            enum: Object.values(SummarySectionType),
          },
          statementText: {
            type: 'string',
            description: 'Under 400 characters. A single factual statement in your own words, grounded only in the provided sentences.',
          },
          citedSentenceIds: {
            type: 'array',
            description: 'One or more sentenceId values from THIS chunk that support this statement. Never invent an ID not given to you.',
            items: { type: 'string' },
          },
        },
        required: ['sectionType', 'statementText', 'citedSentenceIds'],
      },
    },
  },
  required: ['statements'],
} as const;

export interface ParsedChunkAnalysis {
  statements: Array<{
    sectionType: string;
    statementText: string;
    citedSentenceIds: string[];
  }>;
}

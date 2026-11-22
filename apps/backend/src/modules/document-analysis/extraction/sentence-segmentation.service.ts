import { Injectable } from '@nestjs/common';
import { split } from 'sentence-splitter';

// Imported via require(), not a static `from 'sentence-splitter/lang'`:
// Node's runtime resolution honours that subpath's package.json `exports`
// entry correctly (confirmed in the Phase 3B spike), but this project's
// tsconfig uses classic "node" module resolution, which does not -- a
// static import of that subpath fails to typecheck even though it works at
// runtime. A local interface replaces the library's own `Language` type to
// avoid depending on that unresolvable import for types too.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { English } = require('sentence-splitter/lang') as { English: Language };

interface Language {
  ABBREVIATIONS: string[];
  PREPOSITIVE_ABBREVIATIONS: string[];
  EXCLAMATION_WORDS: string[];
}

export interface Sentence {
  sequenceNumber: number;
  text: string;
  normalizedText: string;
}

// sentence-splitter's built-in English abbreviation list already covers Mr.,
// Rs., Sec., Art., No., Ltd., Pvt., Vs., U.S. and many more (confirmed by
// direct test against a real fixture, not assumed) -- these are specifically
// the gaps found empirically against that fixture: Indian-legal-document
// conventions the library's Western-centric default list doesn't carry.
// Extended via the library's own AbbrMarker.language option, not by
// string-substitution hacks -- this is a supported extension point, not a
// workaround.
const INDIA_LEGAL_ABBREVIATIONS = [
  'M/s.',
  'U/s.',
  'u/s.',
  'Addl.',
  'Spl.',
  "Hon'ble",
  'Ld.',
  'w.e.f.',
  'viz.',
  'Govt.',
  // Found via Phase 3B.1's live adversarial testing: a registered-office
  // address ending in a state abbreviation ("...Noida, U.P. -- 201301...")
  // mis-split mid-sentence, since U.P. wasn't recognised and the following
  // token ("--") isn't a lowercase word, so even the general list alone
  // wouldn't have suppressed the boundary -- it needs the same unconditional
  // (prepositive) treatment the company-suffix fix below does. Entries in
  // this array are spread into BOTH lists below, so adding it here is
  // sufficient. Same risk applies to any similarly-shaped two-letter state
  // abbreviation (M.P., A.P., H.P., ...); only the one actually observed to
  // break is added here rather than speculatively enumerating every state.
  'U.P.',
];

// The library's default ABBREVIATIONS list already contains Pvt./Co./Ltd.,
// but NOT in PREPOSITIVE_ABBREVIATIONS -- confirmed empirically to matter: a
// general-list abbreviation only suppresses the sentence boundary when the
// word immediately after it is lowercase, so a chained company suffix like
// "Pvt. Ltd." (where "Ltd." is itself capitalised) still mis-splits with
// only the general list entry. Prepositive abbreviations suppress the
// boundary unconditionally, which is what a suffix chain needs. The
// documented tradeoff: this can occasionally merge two genuinely separate
// sentences when one of these words truly ends a sentence right before a
// new capitalised one -- but that merged pair is still an exact,
// unmodified substring of the source, so it never violates the fidelity
// requirement, only (rarely) the ideal sentence boundary.
const COMPANY_SUFFIX_ABBREVIATIONS = ['Pvt.', 'Co.', 'Ltd.'];

const CUSTOM_LANGUAGE: Language = {
  ABBREVIATIONS: [...English.ABBREVIATIONS, ...INDIA_LEGAL_ABBREVIATIONS],
  PREPOSITIVE_ABBREVIATIONS: [
    ...English.PREPOSITIVE_ABBREVIATIONS,
    ...INDIA_LEGAL_ABBREVIATIONS,
    ...COMPANY_SUFFIX_ABBREVIATIONS,
  ],
  EXCLAMATION_WORDS: English.EXCLAMATION_WORDS,
};

@Injectable()
export class SentenceSegmentationService {
  // Splits one page's already-extracted text into sentences. Every returned
  // `text` is produced by slicing the ORIGINAL `pageText` string at the
  // library's own byte-offset range -- never a reconstructed/`.raw` property
  // the library hands back -- so "every sentence is an exact substring of
  // the source" is a structural guarantee (array slicing), not a hope that
  // the library's internal reconstruction matches byte-for-byte.
  segment(pageText: string): Sentence[] {
    const nodes = split(pageText, { AbbrMarker: { language: CUSTOM_LANGUAGE } });
    const sentences: Sentence[] = [];
    let sequenceNumber = 0;

    for (const node of nodes) {
      if (node.type !== 'Sentence') continue;
      const [start, end] = node.range;
      const text = pageText.slice(start, end).trim();
      if (!text) continue;

      sequenceNumber += 1;
      sentences.push({
        sequenceNumber,
        text,
        normalizedText: text.toLowerCase().replace(/\s+/g, ' ').trim(),
      });
    }

    return sentences;
  }
}

'use client';

import { useState } from 'react';
import { FileRecord } from '@/hooks/use-files';
import { AiSummaryStatement, ConflictDetail, SummarySectionType } from '@/hooks/use-analysis';

// Extends the legacy SECTION_LABELS map in DocumentAnalysisModal.tsx with
// the two Phase 3C-only section types -- Claude can populate categories the
// regex-based Mock provider never reaches (BACKGROUND_FACTS included, which
// was already dead under Mock before this phase).
export const AI_SECTION_LABELS: Record<SummarySectionType, string> = {
  EXECUTIVE_OVERVIEW: 'Executive Overview',
  BACKGROUND_FACTS: 'Background & Facts',
  PARTIES: 'Parties Involved',
  DATES_CHRONOLOGY: 'Important Dates',
  FINANCIAL_FIGURES: 'Financial Information',
  CLAIMS_LIABILITIES: 'Claims, Dues & Amounts',
  LEGAL_PROVISIONS: 'Important Clauses',
  PROCEEDINGS_ORDERS: 'Proceedings & Orders',
  FINDINGS_DECISIONS: 'Key Facts',
  RELIEF: 'Relief',
  OTHER_MATERIAL: 'Other Material Information',
  RISKS_AND_OBSERVATIONS: 'Risks & Observations',
  ACTION_ITEMS: 'Explicit Action Items',
};

export const AI_SUMMARY_DISCLAIMER =
  'AI-generated document analysis is provided for information and review. It may contain errors and should be verified against the original document. It does not constitute legal, financial or professional advice.';

const TOKEN_TYPE_LABELS: Record<ConflictDetail['type'], string> = {
  CURRENCY: 'amount',
  DATE: 'date',
  PROPER_NOUN: 'name',
  SECTION_REFERENCE: 'section reference',
  PERCENTAGE: 'percentage',
};

function VerificationBadge({ status }: { status: AiSummaryStatement['verificationStatus'] }) {
  if (status === 'VERIFIED') {
    return (
      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
        Verified
      </span>
    );
  }
  if (status === 'PARTIALLY_SUPPORTED') {
    return (
      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
        Partially supported
      </span>
    );
  }
  if (status === 'CONFLICTING_SOURCE') {
    return (
      <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-400">
        Conflicting source
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-400">
      Unsupported
    </span>
  );
}

// Renders the conflicting passages exactly as found -- never collapsed to a
// single "winning" value. Every passage keeps its own page link so a
// reviewer can jump straight to either source and judge for themselves.
function ConflictDisclosure({
  conflicts,
  file,
  onOpenPage,
}: {
  conflicts: ConflictDetail[];
  file: FileRecord;
  onOpenPage: (file: FileRecord, page: number) => void;
}) {
  return (
    <div className="mt-1.5 space-y-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-2.5">
      {conflicts.map((conflict, i) => (
        <div key={i} className="text-xs">
          <p className="font-medium text-orange-300">
            The cited sources disagree on this {TOKEN_TYPE_LABELS[conflict.type]} -- shown as found, not resolved:
          </p>
          <ul className="mt-1 space-y-1">
            {conflict.passages.map((passage, j) => (
              <li key={j} className="flex flex-wrap items-start gap-1.5 text-app-t3">
                <span className="font-mono text-orange-300">{passage.value}</span>
                <span>&mdash; &ldquo;{passage.text}&rdquo;</span>
                <button
                  onClick={() => onOpenPage(file, passage.pageNumber)}
                  className="whitespace-nowrap font-medium text-app-primary hover:underline"
                >
                  p.{passage.pageNumber}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StatementRow({
  statement,
  file,
  onOpenPage,
}: {
  statement: AiSummaryStatement;
  file: FileRecord;
  onOpenPage: (file: FileRecord, page: number) => void;
}) {
  // A citation can repeat the same page across multiple cited sentences --
  // one button per distinct page is enough; the reader doesn't need N
  // identical "p.4" links for one statement.
  const pages = Array.from(new Set(statement.citations.map((c) => c.sentence.pageNumber))).sort((a, b) => a - b);
  const conflicts = statement.verificationStatus === 'CONFLICTING_SOURCE' ? statement.verificationDetails?.conflicts : undefined;

  return (
    <li className="text-sm text-app-text">
      <div className="flex flex-wrap items-start gap-1.5">
        <span>{statement.statementText}</span>
        <VerificationBadge status={statement.verificationStatus} />
      </div>
      <div className="mt-0.5 flex flex-wrap gap-2">
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onOpenPage(file, page)}
            className="whitespace-nowrap text-xs font-medium text-app-primary hover:underline"
          >
            p.{page}
          </button>
        ))}
      </div>
      {conflicts && conflicts.length > 0 && <ConflictDisclosure conflicts={conflicts} file={file} onOpenPage={onOpenPage} />}
    </li>
  );
}

export function AiSummarySection({
  statements,
  file,
  onOpenPage,
}: {
  statements: AiSummaryStatement[];
  file: FileRecord;
  onOpenPage: (file: FileRecord, page: number) => void;
}) {
  const [showUnsupported, setShowUnsupported] = useState(false);

  // CONFLICTING_SOURCE carries information a reviewer needs to see directly
  // -- it is never hidden behind the disclosure toggle the way a merely
  // weak-evidence UNSUPPORTED statement is.
  const shown = statements.filter((s) => s.verificationStatus !== 'UNSUPPORTED');
  const unsupported = statements.filter((s) => s.verificationStatus === 'UNSUPPORTED');

  const bySection = new Map<SummarySectionType, AiSummaryStatement[]>();
  for (const statement of shown) {
    const list = bySection.get(statement.sectionType) ?? [];
    list.push(statement);
    bySection.set(statement.sectionType, list);
  }

  return (
    <div className="space-y-5">
      <p className="rounded-md bg-app-s2 px-3 py-2 text-xs text-app-t3">{AI_SUMMARY_DISCLAIMER}</p>

      {Array.from(bySection.entries()).map(([sectionType, sectionStatements]) => (
        <div key={sectionType}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-t3">{AI_SECTION_LABELS[sectionType]}</h3>
          <ul className="space-y-2">
            {sectionStatements.map((statement) => (
              <StatementRow key={statement.id} statement={statement} file={file} onOpenPage={onOpenPage} />
            ))}
          </ul>
        </div>
      ))}

      {unsupported.length > 0 && (
        <div className="border-t border-app-border pt-3">
          <button
            onClick={() => setShowUnsupported((v) => !v)}
            className="text-xs font-medium text-app-t3 hover:text-app-text"
          >
            {showUnsupported ? 'Hide' : 'Show'} {unsupported.length} unsupported statement{unsupported.length === 1 ? '' : 's'}
          </button>
          {showUnsupported && (
            <ul className="mt-2 space-y-2">
              {unsupported.map((statement) => (
                <StatementRow key={statement.id} statement={statement} file={file} onOpenPage={onOpenPage} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

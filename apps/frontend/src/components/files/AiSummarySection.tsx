'use client';

import { useState } from 'react';
import { FileRecord } from '@/hooks/use-files';
import { AiSummaryStatement, SummarySectionType } from '@/hooks/use-analysis';

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

function VerificationBadge({ status }: { status: AiSummaryStatement['verificationStatus'] }) {
  if (status === 'VERIFIED') {
    return (
      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
        Verified
      </span>
    );
  }
  if (status === 'PARTIALLY_VERIFIED') {
    return (
      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
        Partially verified
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-400">
      Unverified
    </span>
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
  const [showUnverified, setShowUnverified] = useState(false);

  const verified = statements.filter((s) => s.verificationStatus !== 'UNVERIFIED');
  const unverified = statements.filter((s) => s.verificationStatus === 'UNVERIFIED');

  const bySection = new Map<SummarySectionType, AiSummaryStatement[]>();
  for (const statement of verified) {
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

      {unverified.length > 0 && (
        <div className="border-t border-app-border pt-3">
          <button
            onClick={() => setShowUnverified((v) => !v)}
            className="text-xs font-medium text-app-t3 hover:text-app-text"
          >
            {showUnverified ? 'Hide' : 'Show'} {unverified.length} unverified statement{unverified.length === 1 ? '' : 's'}
          </button>
          {showUnverified && (
            <ul className="mt-2 space-y-2">
              {unverified.map((statement) => (
                <StatementRow key={statement.id} statement={statement} file={file} onOpenPage={onOpenPage} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

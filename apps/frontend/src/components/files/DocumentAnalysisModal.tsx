'use client';

import { useState } from 'react';
import { FileRecord } from '@/hooks/use-files';
import {
  useFileAnalysis,
  useRequestFileAnalysis,
  useRetryFileAnalysis,
  useCancelFileAnalysis,
  SummarySectionType,
} from '@/hooks/use-analysis';
import { extractErrorMessage } from '@/lib/error-message';

const SECTION_LABELS: Record<SummarySectionType, string> = {
  EXECUTIVE_OVERVIEW: 'Executive Overview',
  BACKGROUND_FACTS: 'Background & Facts',
  PARTIES: 'Parties',
  DATES_CHRONOLOGY: 'Dates & Chronology',
  FINANCIAL_FIGURES: 'Financial Figures',
  CLAIMS_LIABILITIES: 'Claims & Liabilities',
  LEGAL_PROVISIONS: 'Legal Provisions',
  PROCEEDINGS_ORDERS: 'Proceedings & Orders',
  FINDINGS_DECISIONS: 'Findings & Decisions',
  RELIEF: 'Relief',
  OTHER_MATERIAL: 'Other Material Information',
};

export function DocumentAnalysisModal({
  dataRoomId,
  file,
  onClose,
  onOpenPage,
}: {
  dataRoomId: string;
  file: FileRecord;
  onClose: () => void;
  // Reuses the existing, already-authorised preview mechanism -- this modal
  // never fetches or renders PDF content itself, only extracted sentences
  // and page numbers.
  onOpenPage: (file: FileRecord, page: number) => void;
}) {
  const { data: analysis, isLoading, isError, error: queryError } = useFileAnalysis(dataRoomId, file.id);
  const requestAnalysis = useRequestFileAnalysis(dataRoomId, file.id);
  const retryAnalysis = useRetryFileAnalysis(dataRoomId, file.id);
  const cancelAnalysis = useCancelFileAnalysis(dataRoomId, file.id);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleGenerate() {
    setActionError(null);
    try {
      await requestAnalysis.mutateAsync();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  }

  async function handleRetry() {
    if (!analysis) return;
    setActionError(null);
    try {
      await retryAnalysis.mutateAsync(analysis.id);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  }

  async function handleCancel() {
    if (!analysis) return;
    setActionError(null);
    try {
      await cancelAnalysis.mutateAsync(analysis.id);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  }

  const isBusy = requestAnalysis.isPending || retryAnalysis.isPending || cancelAnalysis.isPending;
  // Defensive, mirroring the backend worker's own rule -- it only ever
  // writes a section once it has at least one verified sentence, so this
  // should never filter anything out in practice, but a section with no
  // sentences must never render as an empty heading.
  const visibleSections = (analysis?.sections ?? []).filter((section) => section.sentenceRefs.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-app-s1 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-app-text">AI Summary — {file.name}</p>
            <p className="text-xs text-app-t3">Every sentence below is extracted verbatim from the source document.</p>
          </div>
          <button onClick={onClose} className="ml-3 flex-shrink-0 text-app-t3 hover:text-app-t2" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {actionError && <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{actionError}</p>}

          {isLoading && <p className="text-sm text-app-t3">Loading…</p>}

          {!isLoading && isError && (
            <p className="text-sm text-red-400">{extractErrorMessage(queryError)}</p>
          )}

          {!isLoading && !isError && !analysis && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="max-w-sm text-sm text-app-t3">
                No summary has been generated for this document yet. A summary extracts and organises sentences
                verbatim from the original PDF — nothing is rewritten, paraphrased, or invented.
              </p>
              <button
                onClick={handleGenerate}
                disabled={isBusy}
                className="rounded-md bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-500/100 disabled:opacity-50"
              >
                {requestAnalysis.isPending ? 'Starting…' : 'Generate Summary'}
              </button>
            </div>
          )}

          {!isLoading && analysis && (analysis.status === 'PENDING' || analysis.status === 'PROCESSING') && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-app-border2 border-t-app-primary"
                aria-hidden="true"
              />
              <p className="text-sm text-app-t2">
                {analysis.status === 'PENDING' ? 'Queued for analysis…' : 'Analysing document…'}
              </p>
              <button
                onClick={handleCancel}
                disabled={isBusy}
                className="text-xs font-medium text-app-t3 hover:text-app-text disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}

          {!isLoading && analysis && analysis.status === 'FAILED' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="max-w-sm text-sm text-red-400">
                {analysis.errorMessage ?? 'This document could not be analysed.'}
              </p>
              <button
                onClick={handleRetry}
                disabled={isBusy}
                className="rounded-md border border-app-border2 px-4 py-2 text-sm font-medium text-app-t2 hover:bg-app-s2 disabled:opacity-50"
              >
                {retryAnalysis.isPending ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}

          {!isLoading && analysis && analysis.status === 'CANCELLED' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-app-t3">Analysis was cancelled.</p>
              <button
                onClick={handleGenerate}
                disabled={isBusy}
                className="rounded-md bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-500/100 disabled:opacity-50"
              >
                {requestAnalysis.isPending ? 'Starting…' : 'Generate Summary'}
              </button>
            </div>
          )}

          {!isLoading && analysis && (analysis.status === 'COMPLETED' || analysis.status === 'COMPLETED_WITH_WARNINGS') && (
            <div className="space-y-5">
              {analysis.status === 'COMPLETED_WITH_WARNINGS' && (
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  Some pages in this document could not be read (for example, scanned or image-only pages) and are
                  excluded from this summary.
                </p>
              )}

              {visibleSections.length === 0 && (
                <p className="text-sm text-app-t3">No summarisable content was found in this document.</p>
              )}

              {visibleSections.map((section) => (
                <div key={section.id}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-t3">
                    {SECTION_LABELS[section.sectionType]}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.sentenceRefs.map((ref) => (
                      <li key={ref.id} className="text-sm text-app-text">
                        {ref.sentence.text}{' '}
                        <button
                          onClick={() => onOpenPage(file, ref.sentence.pageNumber)}
                          className="ml-1 whitespace-nowrap text-xs font-medium text-app-primary hover:underline"
                        >
                          p.{ref.sentence.pageNumber}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="border-t border-app-border pt-3">
                <button
                  onClick={handleGenerate}
                  disabled={isBusy}
                  className="text-xs font-medium text-app-t3 hover:text-app-text disabled:opacity-50"
                >
                  {requestAnalysis.isPending ? 'Starting…' : 'Regenerate summary'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

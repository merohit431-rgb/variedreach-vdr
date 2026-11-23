import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type DocumentAnalysisStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'FAILED'
  | 'CANCELLED';

export type SummarySectionType =
  | 'EXECUTIVE_OVERVIEW'
  | 'BACKGROUND_FACTS'
  | 'PARTIES'
  | 'DATES_CHRONOLOGY'
  | 'FINANCIAL_FIGURES'
  | 'CLAIMS_LIABILITIES'
  | 'LEGAL_PROVISIONS'
  | 'PROCEEDINGS_ORDERS'
  | 'FINDINGS_DECISIONS'
  | 'RELIEF'
  | 'OTHER_MATERIAL'
  | 'RISKS_AND_OBSERVATIONS'
  | 'ACTION_ITEMS';

// Phase 3C: Claude-backed synthesis types. All optional on DocumentAnalysis
// below -- absent/null whenever Claude was never enabled for a given
// analysis, preserving the exact pre-Phase-3C response shape in that case.
export type AiSummaryRunStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'FAILED'
  | 'SKIPPED_LIMIT_REACHED';

export type StatementVerificationStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED';

export type PageExtractionMethod = 'NATIVE_TEXT' | 'OCR' | 'OCR_FAILED' | 'UNAVAILABLE';

export interface ExtractedPageSummary {
  pageNumber: number;
  extractionMethod: PageExtractionMethod;
  ocrConfidence: number | null;
  isScannedOrImageOnly: boolean;
}

export interface AiSummaryCitation {
  id: string;
  sentence: ExtractedSentenceSummary;
}

export interface AiSummaryStatement {
  id: string;
  sectionType: SummarySectionType;
  displayOrder: number;
  statementText: string;
  verificationStatus: StatementVerificationStatus;
  citations: AiSummaryCitation[];
}

export interface AiSummaryRun {
  status: AiSummaryRunStatus;
  modelUsed: string | null;
  errorMessage: string | null;
  chunkCount: number;
  completedChunkIndexes: number[];
  statements?: AiSummaryStatement[];
}

export interface ExtractedSentenceSummary {
  id: string;
  pageNumber: number;
  sequenceNumber: number;
  text: string;
}

export interface SummarySentenceReference {
  id: string;
  rank: number;
  score: number;
  sentence: ExtractedSentenceSummary;
}

export interface SummarySection {
  id: string;
  sectionType: SummarySectionType;
  displayOrder: number;
  sentenceRefs: SummarySentenceReference[];
}

export interface DocumentAnalysis {
  id: string;
  fileId: string;
  status: DocumentAnalysisStatus;
  analysisVersion: number;
  errorMessage: string | null;
  checksumVerified: boolean | null;
  createdAt: string;
  completedAt: string | null;
  // Only present on the GET endpoints (a single-analysis fetch with its
  // sections included) -- absent on the bare row returned by POST .../analysis.
  sections?: SummarySection[];
  // Phase 3C additions, same GET-only availability as `sections` above.
  // `pages` carries no sentence text -- only per-page extraction method and
  // OCR confidence. `aiSummaryRun` is null/absent whenever Claude was never
  // enabled for this analysis.
  pages?: ExtractedPageSummary[];
  aiSummaryRun?: AiSummaryRun | null;
}

const ACTIVE_STATUSES: DocumentAnalysisStatus[] = ['PENDING', 'PROCESSING'];

function analysisQueryKey(dataRoomId: string, fileId: string) {
  return ['data-rooms', dataRoomId, 'files', fileId, 'analysis'];
}

// Polls only while the latest analysis is PENDING/PROCESSING -- this is a
// genuinely async, queue-backed job, not an immediate response, so the GET
// result's own status decides whether to keep polling. `data` is `null`
// (not a 404) when no analysis has ever been requested for this file.
export function useFileAnalysis(dataRoomId: string, fileId: string) {
  return useQuery({
    queryKey: analysisQueryKey(dataRoomId, fileId),
    queryFn: async () => {
      const response = await apiClient.get<{ data: DocumentAnalysis | null }>(
        `/data-rooms/${dataRoomId}/files/${fileId}/analysis`,
      );
      return response.data.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_STATUSES.includes(status) ? 3000 : false;
    },
  });
}

// Also used to regenerate once a terminal analysis already exists -- the
// backend's own versioning (analysisVersion, dedup against an already
// PENDING/PROCESSING row) decides whether this starts a new run.
export function useRequestFileAnalysis(dataRoomId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ data: DocumentAnalysis }>(
        `/data-rooms/${dataRoomId}/files/${fileId}/analysis`,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analysisQueryKey(dataRoomId, fileId) });
    },
  });
}

export function useRetryFileAnalysis(dataRoomId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (analysisId: string) => {
      const response = await apiClient.post<{ data: DocumentAnalysis }>(
        `/data-rooms/${dataRoomId}/files/${fileId}/analysis/${analysisId}/retry`,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analysisQueryKey(dataRoomId, fileId) });
    },
  });
}

export function useCancelFileAnalysis(dataRoomId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (analysisId: string) => {
      await apiClient.delete(`/data-rooms/${dataRoomId}/files/${fileId}/analysis/${analysisId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analysisQueryKey(dataRoomId, fileId) });
    },
  });
}

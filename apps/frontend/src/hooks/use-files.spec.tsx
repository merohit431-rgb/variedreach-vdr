import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useFiles, type FileRecord } from './use-files';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  apiClient: { get: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const sampleFiles: FileRecord[] = Array.from({ length: 8 }, (_, i) => ({
  id: `file-${i}`,
  dataRoomId: 'room-1',
  folderId: null,
  name: `document-${i}.pdf`,
  description: null,
  mimeType: 'application/pdf',
  extension: 'pdf',
  sizeBytes: '1024',
  currentVersionId: `version-${i}`,
  currentVersion: null,
  isLocked: false,
  uploadedBy: 'user-1',
  uploader: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}));

// Regression coverage for a bug where the real backend envelope
// (`{ success, statusCode, message, data: FileRecord[], meta }` --
// `data` and `meta` are siblings, confirmed against the live API) was
// mapped through a type of `{ data: { data, meta } }` and a return of
// `response.data.data`, over-unwrapping by one level. That resolved to
// the bare FileRecord[] instead of `{ data, meta }`, so every consumer
// reading `filesResponse?.data` (e.g. FileBrowser.tsx) got `undefined`
// and rendered every room's file list as empty, regardless of how many
// files actually existed -- the file-count badge (a separate stats
// source) still showed the correct total, producing the exact "shows
// 8, renders empty" symptom.
describe('useFiles', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('resolves to { data, meta }, not the bare files array', async () => {
    mockedGet.mockResolvedValue({
      data: {
        success: true,
        statusCode: 200,
        message: 'Operation successful',
        data: sampleFiles,
        meta: { page: 1, limit: 200, total: 8, totalPages: 1 },
      },
    });

    const { result } = renderHook(() => useFiles('room-1', { folderId: null, search: '' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data)).toBe(false);
    expect(result.current.data?.data).toHaveLength(8);
    expect(result.current.data?.data).toEqual(sampleFiles);
    expect(result.current.data?.meta).toEqual({ page: 1, limit: 200, total: 8, totalPages: 1 });
  });

  it('omits both folderId and search when browsing the root folder', async () => {
    mockedGet.mockResolvedValue({
      data: { success: true, statusCode: 200, message: 'ok', data: [], meta: { page: 1, limit: 200, total: 0, totalPages: 0 } },
    });

    const { result } = renderHook(() => useFiles('room-1', { folderId: null, search: '' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGet).toHaveBeenCalledWith('/data-rooms/room-1/files', {
      params: { page: 1, limit: 200 },
    });
  });

  it('sends folderId for a non-root folder', async () => {
    mockedGet.mockResolvedValue({
      data: { success: true, statusCode: 200, message: 'ok', data: [], meta: { page: 1, limit: 200, total: 0, totalPages: 0 } },
    });

    const { result } = renderHook(() => useFiles('room-1', { folderId: 'folder-9', search: '' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGet).toHaveBeenCalledWith('/data-rooms/room-1/files', {
      params: { page: 1, limit: 200, folderId: 'folder-9' },
    });
  });

  it('sends search instead of folderId when searching', async () => {
    mockedGet.mockResolvedValue({
      data: { success: true, statusCode: 200, message: 'ok', data: [], meta: { page: 1, limit: 200, total: 0, totalPages: 0 } },
    });

    const { result } = renderHook(() => useFiles('room-1', { folderId: 'folder-9', search: 'invoice' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGet).toHaveBeenCalledWith('/data-rooms/room-1/files', {
      params: { page: 1, limit: 200, search: 'invoice' },
    });
  });
});

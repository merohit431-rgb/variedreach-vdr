import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useGrantFolderAccess, useRevokeFolderAccess } from './use-folder-permissions';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  apiClient: { post: jest.fn(), delete: jest.fn() },
}));

const mockedPost = apiClient.post as jest.Mock;
const mockedDelete = apiClient.delete as jest.Mock;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// Regression coverage: granting/revoking a specific folder's access only
// invalidated the folder-access and folder-tree caches, never the sibling
// files cache. A file list already open in a session (or another tab on
// the same client) would keep showing stale contents after a folder-level
// restriction change until an unrelated remount happened. Flagged
// explicitly by the user as an area to verify ("Folder-level restriction
// changes and stale frontend state" / "after... changing folder
// permissions").
describe('folder permission mutations invalidate the files cache', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedDelete.mockReset();
  });

  it('useGrantFolderAccess invalidates the files query for that room', async () => {
    mockedPost.mockResolvedValue({ data: {} });
    const queryClient = new QueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useGrantFolderAccess('room-1', 'folder-9'), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ userId: 'user-5' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['data-rooms', 'room-1', 'files'] });
  });

  it('useRevokeFolderAccess invalidates the files query for that room', async () => {
    mockedDelete.mockResolvedValue({ data: {} });
    const queryClient = new QueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRevokeFolderAccess('room-1', 'folder-9'), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ userId: 'user-5' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['data-rooms', 'room-1', 'files'] });
  });
});

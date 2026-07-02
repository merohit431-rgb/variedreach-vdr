import { create } from 'zustand';
import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { extractErrorMessage } from '@/lib/error-message';

export type ImportStatus = 'queued' | 'importing' | 'ready' | 'failed' | 'canceled';
export type ImportProvider = 'google-drive' | 'onedrive';

export interface ImportItem {
  id: string;
  dataRoomId: string;
  folderId: string | null;
  provider: ImportProvider;
  name: string;
  sizeBytes: number;
  mimeType: string;
  relativePath: string;
  status: ImportStatus;
  error: string | null;
  googleFileId?: string;
  googleAccessToken?: string;
  oneDriveDownloadUrl?: string;
}

interface EnqueueInput {
  dataRoomId: string;
  folderId: string | null;
  provider: ImportProvider;
  name: string;
  sizeBytes: number;
  mimeType: string;
  relativePath: string;
  queryClient: QueryClient;
  googleFileId?: string;
  googleAccessToken?: string;
  oneDriveDownloadUrl?: string;
}

interface ImportStoreState {
  items: ImportItem[];
  enqueue: (input: EnqueueInput) => string;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clearFinished: (dataRoomId: string) => void;
}

const MAX_CONCURRENT = 2;
const FINISHED: ImportStatus[] = ['ready', 'failed', 'canceled'];

const queryClients = new Map<string, QueryClient>();
const abortControllers = new Map<string, AbortController>();

export const useImportStore = create<ImportStoreState>(() => ({
  items: [],

  enqueue: (input) => {
    const id = crypto.randomUUID();
    queryClients.set(id, input.queryClient);

    useImportStore.setState((state) => ({
      items: [
        ...state.items,
        {
          id,
          dataRoomId: input.dataRoomId,
          folderId: input.folderId,
          provider: input.provider,
          name: input.name,
          sizeBytes: input.sizeBytes,
          mimeType: input.mimeType,
          relativePath: input.relativePath,
          status: 'queued',
          error: null,
          googleFileId: input.googleFileId,
          googleAccessToken: input.googleAccessToken,
          oneDriveDownloadUrl: input.oneDriveDownloadUrl,
        },
      ],
    }));

    processQueue();
    return id;
  },

  cancel: (id) => {
    abortControllers.get(id)?.abort();
    patchItem(id, { status: 'canceled' });
  },

  retry: (id) => {
    patchItem(id, { status: 'queued', error: null });
    processQueue();
  },

  remove: (id) => {
    queryClients.delete(id);
    useImportStore.setState((state) => ({ items: state.items.filter((i) => i.id !== id) }));
  },

  clearFinished: (dataRoomId) => {
    useImportStore.setState((state) => ({
      items: state.items.filter(
        (i) => i.dataRoomId !== dataRoomId || !FINISHED.includes(i.status),
      ),
    }));
  },
}));

function patchItem(id: string, patch: Partial<ImportItem>) {
  useImportStore.setState((state) => ({
    items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  }));
}

function processQueue() {
  const { items } = useImportStore.getState();
  const active = items.filter((i) => i.status === 'importing').length;
  const slots = MAX_CONCURRENT - active;
  if (slots <= 0) return;
  items
    .filter((i) => i.status === 'queued')
    .slice(0, slots)
    .forEach((i) => importOne(i.id));
}

async function importOne(id: string) {
  const item = useImportStore.getState().items.find((i) => i.id === id);
  if (!item) return;

  const controller = new AbortController();
  abortControllers.set(id, controller);
  patchItem(id, { status: 'importing' });

  try {
    const isGoogle = item.provider === 'google-drive';
    const endpoint = `/data-rooms/${item.dataRoomId}/cloud-import/${isGoogle ? 'google-drive' : 'onedrive'}`;

    const hasRelativePath = item.relativePath && item.relativePath !== item.name;

    const body = isGoogle
      ? {
          name: item.name,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          googleFileId: item.googleFileId,
          accessToken: item.googleAccessToken,
          ...(hasRelativePath ? { relativePath: item.relativePath } : {}),
          ...(item.folderId ? { folderId: item.folderId } : {}),
        }
      : {
          name: item.name,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          downloadUrl: item.oneDriveDownloadUrl,
          ...(hasRelativePath ? { relativePath: item.relativePath } : {}),
          ...(item.folderId ? { folderId: item.folderId } : {}),
        };

    await apiClient.post(endpoint, body, { signal: controller.signal });

    patchItem(id, { status: 'ready' });
    const qc = queryClients.get(id);
    qc?.invalidateQueries({ queryKey: ['data-rooms', item.dataRoomId, 'files'] });
    qc?.invalidateQueries({ queryKey: ['data-rooms', item.dataRoomId, 'folders'] });
    qc?.invalidateQueries({ queryKey: ['data-rooms', item.dataRoomId] });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'CanceledError';
    if (controller.signal.aborted || isAbort) {
      patchItem(id, { status: 'canceled' });
    } else {
      patchItem(id, { status: 'failed', error: extractErrorMessage(err) });
    }
  } finally {
    abortControllers.delete(id);
    processQueue();
  }
}

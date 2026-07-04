import { create } from 'zustand';
import axios from 'axios';
import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { extractErrorMessage } from '@/lib/error-message';
import type { FileRecord } from '@/hooks/use-files';

export type UploadStatus = 'queued' | 'uploading' | 'processing' | 'ready' | 'failed' | 'canceled';

export interface UploadItem {
  id: string;
  dataRoomId: string;
  folderId: string | null;
  file: File;
  relativePath: string;
  status: UploadStatus;
  progressPercent: number;
  uploadedBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number | null;
  error: string | null;
  createdFile: FileRecord | null;
}

interface EnqueueInput {
  dataRoomId: string;
  folderId: string | null;
  file: File;
  relativePath: string;
  queryClient: QueryClient;
}

interface UploadStoreState {
  items: UploadItem[];
  enqueue: (input: EnqueueInput) => string;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clearFinished: (dataRoomId: string) => void;
}

const MAX_CONCURRENT_UPLOADS = 3;
const FINISHED_STATUSES: UploadStatus[] = ['ready', 'failed', 'canceled'];

const abortControllers = new Map<string, AbortController>();
const queryClients = new Map<string, QueryClient>();

export const useUploadStore = create<UploadStoreState>((set, get) => ({
  items: [],

  enqueue: (input) => {
    const id = crypto.randomUUID();
    queryClients.set(id, input.queryClient);

    set((state) => ({
      items: [
        ...state.items,
        {
          id,
          dataRoomId: input.dataRoomId,
          folderId: input.folderId,
          file: input.file,
          relativePath: input.relativePath,
          status: 'queued',
          progressPercent: 0,
          uploadedBytes: 0,
          speedBytesPerSec: 0,
          etaSeconds: null,
          error: null,
          createdFile: null,
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
    patchItem(id, { status: 'queued', progressPercent: 0, uploadedBytes: 0, error: null });
    processQueue();
  },

  remove: (id) => {
    queryClients.delete(id);
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },

  clearFinished: (dataRoomId) => {
    set((state) => ({
      items: state.items.filter(
        (item) => item.dataRoomId !== dataRoomId || !FINISHED_STATUSES.includes(item.status),
      ),
    }));
  },
}));

function patchItem(id: string, patch: Partial<UploadItem>) {
  useUploadStore.setState((state) => ({
    items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  }));
}

function processQueue() {
  const { items } = useUploadStore.getState();
  const activeCount = items.filter((item) => item.status === 'uploading' || item.status === 'processing').length;
  const slotsAvailable = MAX_CONCURRENT_UPLOADS - activeCount;
  if (slotsAvailable <= 0) return;

  const queued = items.filter((item) => item.status === 'queued').slice(0, slotsAvailable);
  queued.forEach((item) => uploadOne(item.id));
}

async function uploadOne(id: string) {
  const item = useUploadStore.getState().items.find((i) => i.id === id);
  if (!item) return;

  const controller = new AbortController();
  abortControllers.set(id, controller);
  patchItem(id, { status: 'uploading', progressPercent: 0 });

  let lastLoaded = 0;
  let lastTime = Date.now();

  const formData = new FormData();
  formData.append('files', item.file);
  if (item.folderId) formData.append('folderId', item.folderId);
  formData.append('relativePaths', JSON.stringify([item.relativePath]));

  try {
    const response = await apiClient.post<{ data: FileRecord[] }>(
      `/data-rooms/${item.dataRoomId}/files`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        onUploadProgress: (event) => {
          const loaded = event.loaded;
          const total = event.total ?? item.file.size;
          const now = Date.now();
          const elapsedSec = (now - lastTime) / 1000;

          let speedBytesPerSec: number | undefined;
          if (elapsedSec > 0.2) {
            speedBytesPerSec = (loaded - lastLoaded) / elapsedSec;
            lastLoaded = loaded;
            lastTime = now;
          }

          // Network transfer can reach 100% well before the server responds
          // (it still has to write the file and create the DB records) --
          // cap the bar at 99% so "uploading" doesn't read as "done" early.
          const percent = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
          const remainingBytes = Math.max(total - loaded, 0);

          patchItem(id, {
            progressPercent: percent,
            uploadedBytes: loaded,
            status: percent >= 99 ? 'processing' : 'uploading',
            ...(speedBytesPerSec !== undefined
              ? {
                  speedBytesPerSec,
                  etaSeconds: speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : null,
                }
              : {}),
          });
        },
      },
    );

    const createdFile = response.data.data[0] ?? null;
    patchItem(id, { status: 'ready', progressPercent: 100, etaSeconds: 0, createdFile });

    const queryClient = queryClients.get(id);
    queryClient?.invalidateQueries({ queryKey: ['data-rooms', item.dataRoomId, 'files'] });
    queryClient?.invalidateQueries({ queryKey: ['data-rooms', item.dataRoomId, 'folders'] });
    queryClient?.invalidateQueries({ queryKey: ['data-rooms', item.dataRoomId] });
  } catch (error) {
    if (axios.isCancel(error) || controller.signal.aborted) {
      patchItem(id, { status: 'canceled' });
    } else {
      patchItem(id, { status: 'failed', error: extractErrorMessage(error) });
    }
  } finally {
    abortControllers.delete(id);
    processQueue();
  }
}

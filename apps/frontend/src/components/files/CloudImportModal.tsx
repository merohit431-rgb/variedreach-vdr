'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  Cloud,
  FolderOpen,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Info,
  Clock,
  LogOut,
} from 'lucide-react';
import { useImportStore, ImportProvider } from '@/store/import-store';
import { useFolders } from '@/hooks/use-folders';
import { formatBytes } from '@/lib/format';
import { getFileIcon } from '@/lib/file-icon';

// External SDK types — no TS definitions available
declare global {
  interface Window {
    gapi: any;
    google: any;
    OneDrive: any;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? '';
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY ?? '';
const MICROSOFT_CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID ?? '';

const GOOGLE_WORKSPACE_PREFIX = 'application/vnd.google-apps.';
const GOOGLE_WORKSPACE_FOLDER = 'application/vnd.google-apps.folder';

// Google tokens expire in 1 hour; we treat them as valid for 55 minutes
const GDRIVE_TOKEN_TTL_MS = 55 * 60 * 1000;
const GDRIVE_TOKEN_KEY = 'vdr_gdrive_token';

// ─── Token persistence (Google Drive) ────────────────────────────────────────

function saveGDriveToken(token: string): void {
  try {
    localStorage.setItem(
      GDRIVE_TOKEN_KEY,
      JSON.stringify({ token, expiry: Date.now() + GDRIVE_TOKEN_TTL_MS }),
    );
  } catch { /* storage may be unavailable */ }
}

function loadGDriveToken(): string | null {
  try {
    const raw = localStorage.getItem(GDRIVE_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: unknown; expiry?: unknown };
    if (typeof parsed.token !== 'string' || typeof parsed.expiry !== 'number') throw new Error();
    // Require at least 5 minutes remaining
    if (parsed.expiry > Date.now() + 5 * 60 * 1000) return parsed.token;
    localStorage.removeItem(GDRIVE_TOKEN_KEY);
  } catch {
    try { localStorage.removeItem(GDRIVE_TOKEN_KEY); } catch { /* ignore */ }
  }
  return null;
}

function clearGDriveToken(): void {
  try { localStorage.removeItem(GDRIVE_TOKEN_KEY); } catch { /* ignore */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectedFile {
  name: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
  googleFileId?: string;
  oneDriveDownloadUrl?: string;
}

interface ImportSummary {
  count: number;
  totalBytes: number;
  provider: ImportProvider;
  folderName: string;
}

interface Props {
  dataRoomId: string;
  folderId: string | null;
  initialProvider: ImportProvider;
  onClose: () => void;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function listDriveFolder(
  folderId: string,
  accessToken: string,
  currentPath: string,
  signal: AbortSignal,
): Promise<SelectedFile[]> {
  const files: SelectedFile[] = [];
  let pageToken: string | undefined;

  do {
    if (signal.aborted) break;
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
    if (!res.ok) break;
    const data = await res.json() as {
      files?: Array<{ id: string; name: string; mimeType: string; size?: string }>;
      nextPageToken?: string;
    };

    for (const item of data.files ?? []) {
      const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      if (item.mimeType === GOOGLE_WORKSPACE_FOLDER) {
        files.push(...await listDriveFolder(item.id, accessToken, itemPath, signal));
      } else if (!item.mimeType.startsWith(GOOGLE_WORKSPACE_PREFIX)) {
        files.push({
          name: item.name,
          mimeType: item.mimeType,
          sizeBytes: parseInt(item.size ?? '0', 10),
          relativePath: itemPath,
          googleFileId: item.id,
        });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

// ─── Not-configured notice ────────────────────────────────────────────────────

function NotConfiguredNotice({ provider }: { provider: ImportProvider }) {
  const name = provider === 'google-drive' ? 'Google Drive' : 'Microsoft OneDrive';
  const vars =
    provider === 'google-drive'
      ? 'NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY'
      : 'NEXT_PUBLIC_MICROSOFT_CLIENT_ID';
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
        <Info className="h-6 w-6 text-amber-500" aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold text-slate-800">{name} not configured</p>
        <p className="mt-1.5 text-sm text-slate-500">
          Set{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">{vars}</code>{' '}
          in your environment to enable this integration.
        </p>
      </div>
    </div>
  );
}

// ─── Folder selector ──────────────────────────────────────────────────────────

function FolderSelector({
  dataRoomId,
  value,
  onChange,
}: {
  dataRoomId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { data: folders } = useFolders(dataRoomId);
  const sorted = [...(folders ?? [])].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
        Destination folder in VDR
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
      >
        <option value="">/ Root</option>
        {sorted.map((f) => (
          <option key={f.id} value={f.id}>
            {'  '.repeat(f.depth)}
            {f.depth > 0 ? '└─ ' : ''}
            {f.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Import summary screen ────────────────────────────────────────────────────

function ImportSummaryScreen({
  summary,
  onClose,
}: {
  summary: ImportSummary;
  onClose: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(4);
  const providerName = summary.provider === 'google-drive' ? 'Google Drive' : 'Microsoft OneDrive';

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { onClose(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div className="flex flex-col items-center gap-6 px-8 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-slate-900">Import started</h3>
        <p className="text-sm text-slate-600">
          <span className="font-medium">{summary.count}</span>{' '}
          file{summary.count !== 1 ? 's' : ''} queued from {providerName}
        </p>
        <p className="text-sm text-slate-600">
          {formatBytes(summary.totalBytes)} total &middot; Importing into{' '}
          <span className="font-medium">{summary.folderName}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        <Clock className="h-4 w-4" aria-hidden="true" />
        Track progress in the Transfers panel
      </div>
      <button
        onClick={onClose}
        className="rounded-md border border-slate-200 px-6 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Close ({secondsLeft}s)
      </button>
    </div>
  );
}

// ─── Google Drive tab ─────────────────────────────────────────────────────────

interface GoogleTabProps {
  selectedFiles: SelectedFile[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>;
  scanning: boolean;
  setScanning: (v: boolean) => void;
  onTokenObtained: (token: string) => void;
}

function GoogleDriveTab({
  selectedFiles,
  setSelectedFiles,
  scanning,
  setScanning,
  onTokenObtained,
}: GoogleTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const accessTokenRef = useRef<string | null>(null);
  const scanAbortRef = useRef<AbortController | null>(null);

  // Must be above the early return — hooks cannot be conditional
  useEffect(() => () => { scanAbortRef.current?.abort(); }, []);

  useEffect(() => {
    const stored = loadGDriveToken();
    if (stored) {
      accessTokenRef.current = stored;
      onTokenObtained(stored);
      setConnected(true);
    }
  }, [onTokenObtained]);

  if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
    return <NotConfiguredNotice provider="google-drive" />;
  }

  function handleDisconnect() {
    clearGDriveToken();
    accessTokenRef.current = null;
    setConnected(false);
    setError(null);
    setSkipped([]);
  }

  async function openPicker(token: string) {
    // Ensure picker library is loaded
    if (!window.gapi?.picker) {
      await new Promise<void>((res, rej) =>
        loadScript('https://apis.google.com/js/api.js')
          .then(() => window.gapi.load('picker', { callback: res, onerror: rej }))
          .catch(rej),
      );
    }

    const foldersAndDocs = new window.google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

    new window.google.picker.PickerBuilder()
      .setTitle('Select files or folders to import')
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .addView(foldersAndDocs)
      .setCallback((data: any) => handlePicked(data, token))
      .build()
      .setVisible(true);
  }

  async function handleBrowseAgain() {
    if (connected && accessTokenRef.current) {
      // Token still valid — open picker directly, no re-auth needed
      try {
        await loadScript('https://accounts.google.com/gsi/client');
        await openPicker(accessTokenRef.current);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open picker');
      }
      return;
    }
    await authenticate();
  }

  async function authenticate() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadScript('https://accounts.google.com/gsi/client'),
        new Promise<void>((res, rej) =>
          loadScript('https://apis.google.com/js/api.js')
            .then(() => window.gapi.load('picker', { callback: res, onerror: rej }))
            .catch(rej),
        ),
      ]);

      window.google.accounts.oauth2
        .initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: { access_token?: string; error?: string }) => {
            if (response.error || !response.access_token) {
              setError(`Google sign-in failed: ${response.error ?? 'no token'}`);
              return;
            }
            accessTokenRef.current = response.access_token;
            onTokenObtained(response.access_token);
            saveGDriveToken(response.access_token);
            setConnected(true);
            openPicker(response.access_token);
          },
        })
        .requestAccessToken({ prompt: 'consent' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Google APIs');
    } finally {
      setLoading(false);
    }
  }

  async function handlePicked(data: any, token: string) {
    const P = window.google.picker;
    if (data[P.Response.ACTION] !== P.Action.PICKED) return;

    const docs: any[] = data[P.Response.DOCUMENTS] ?? [];
    const newFiles: SelectedFile[] = [];
    const newSkipped: string[] = [];

    const folders = docs.filter((d: any) => d[P.Document.MIME_TYPE] === GOOGLE_WORKSPACE_FOLDER);
    const regularFiles = docs.filter((d: any) => d[P.Document.MIME_TYPE] !== GOOGLE_WORKSPACE_FOLDER);

    for (const doc of regularFiles) {
      const mime: string = doc[P.Document.MIME_TYPE];
      if (mime.startsWith(GOOGLE_WORKSPACE_PREFIX)) {
        newSkipped.push(doc[P.Document.NAME]);
        continue;
      }
      newFiles.push({
        name: doc[P.Document.NAME],
        mimeType: mime,
        sizeBytes: doc[P.Document.BYTES] ?? 0,
        relativePath: doc[P.Document.NAME],
        googleFileId: doc[P.Document.ID],
      });
    }

    if (folders.length > 0) {
      setScanning(true);
      scanAbortRef.current?.abort();
      const abort = new AbortController();
      scanAbortRef.current = abort;
      try {
        for (const folder of folders) {
          const sub = await listDriveFolder(
            folder[P.Document.ID],
            token,
            folder[P.Document.NAME],
            abort.signal,
          );
          newFiles.push(...sub);
        }
      } finally {
        setScanning(false);
      }
    }

    if (newSkipped.length > 0) setSkipped((prev) => [...prev, ...newSkipped]);
    setSelectedFiles((prev) => {
      const existingIds = new Set(prev.map((f) => f.googleFileId).filter(Boolean));
      return [...prev, ...newFiles.filter((f) => !existingIds.has(f.googleFileId))];
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {connected ? (
          <>
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Connected to Google Drive
            </span>
            <button
              onClick={handleBrowseAgain}
              disabled={loading || scanning}
              className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {scanning ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
              )}
              Browse Again
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500"
              title="Disconnect Google Drive"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={authenticate}
            disabled={loading || scanning}
            className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
            )}
            Connect Google Drive
          </button>
        )}
        {scanning && (
          <span className="flex items-center gap-1.5 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Scanning folders…
          </span>
        )}
      </div>

      {!connected && !loading && (
        <p className="text-sm text-slate-500">
          Sign in with Google to browse your Drive. Imported folders preserve their full
          hierarchy inside the VDR. Your connection will be remembered for 55 minutes.
        </p>
      )}

      {skipped.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>
            {skipped.length} Google Docs/Sheets/Slides file
            {skipped.length !== 1 ? 's were' : ' was'} skipped — export them as PDF or
            Office format first, then import.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── OneDrive tab ─────────────────────────────────────────────────────────────

function OneDriveTab({
  setSelectedFiles,
}: {
  setSelectedFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  // Must be above early return
  useEffect(() => {
    // Nothing to restore — OneDrive SDK manages its own auth state
  }, []);

  if (!MICROSOFT_CLIENT_ID) {
    return <NotConfiguredNotice provider="onedrive" />;
  }

  async function browse() {
    setLoading(true);
    setError(null);
    try {
      await loadScript('https://js.live.net/v7.2/OneDrive.js');
      window.OneDrive.open({
        clientId: MICROSOFT_CLIENT_ID,
        action: 'query',
        multiSelect: true,
        openInNewWindow: true,
        viewType: 'all',
        advanced: {
          queryParameters: 'select=name,size,file,folder,@microsoft.graph.downloadUrl',
        },
        success: (result: { value: any[] }) => {
          const newFiles: SelectedFile[] = [];
          for (const item of result.value ?? []) {
            if (item.folder || !item['@microsoft.graph.downloadUrl']) continue;
            newFiles.push({
              name: item.name,
              mimeType: item.file?.mimeType ?? 'application/octet-stream',
              sizeBytes: item.size ?? 0,
              relativePath: item.name,
              oneDriveDownloadUrl: item['@microsoft.graph.downloadUrl'],
            });
          }
          setConnected(true);
          setSelectedFiles((prev) => {
            const existingUrls = new Set(prev.map((f) => f.oneDriveDownloadUrl).filter(Boolean));
            return [...prev, ...newFiles.filter((f) => !existingUrls.has(f.oneDriveDownloadUrl))];
          });
        },
        cancel: () => {},
        error: (e: { message?: string }) =>
          setError(e?.message ?? 'OneDrive picker error'),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load OneDrive');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {connected && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Connected to OneDrive
          </span>
        )}
        <button
          onClick={browse}
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
          )}
          {connected ? 'Browse Again' : 'Browse OneDrive'}
        </button>
      </div>
      {!connected && !loading && (
        <p className="text-sm text-slate-500">
          Opens a Microsoft sign-in window. Navigate into folders to select files; use
          Ctrl/Cmd+click to select multiple items at once.
        </p>
      )}
    </div>
  );
}

// ─── Selected files list ──────────────────────────────────────────────────────

function SelectedFilesList({
  files,
  onRemove,
}: {
  files: SelectedFile[];
  onRemove: (idx: number) => void;
}) {
  if (files.length === 0) return null;
  const totalBytes = files.reduce((s, f) => s + f.sizeBytes, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          {files.length} file{files.length !== 1 ? 's' : ''} selected
        </span>
        <span className="text-sm text-slate-500">{formatBytes(totalBytes)} total</span>
      </div>
      <div className="max-h-56 divide-y divide-slate-50 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        {files.map((file, idx) => {
          const ext = file.name.split('.').pop() ?? '';
          const Icon = getFileIcon(ext);
          return (
            <div key={idx} className="flex items-center gap-3 px-3 py-2">
              <Icon className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800">{file.name}</p>
                {file.relativePath !== file.name && (
                  <p className="flex items-center gap-1 truncate text-xs text-slate-400">
                    <ChevronRight className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
                    {file.relativePath}
                  </p>
                )}
              </div>
              <span className="flex-shrink-0 text-xs text-slate-400">
                {formatBytes(file.sizeBytes)}
              </span>
              <button
                onClick={() => onRemove(idx)}
                className="flex-shrink-0 text-slate-300 hover:text-red-500"
                title="Remove from selection"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function CloudImportModal({
  dataRoomId,
  folderId,
  initialProvider,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const { enqueue } = useImportStore();
  const { data: folders } = useFolders(dataRoomId);

  const [activeProvider, setActiveProvider] = useState<ImportProvider>(initialProvider);
  const [googleFiles, setGoogleFiles] = useState<SelectedFile[]>([]);
  const [oneDriveFiles, setOneDriveFiles] = useState<SelectedFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [destinationFolderId, setDestinationFolderId] = useState<string | null>(folderId);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const googleTokenRef = useRef<string | null>(null);

  const selectedFiles = activeProvider === 'google-drive' ? googleFiles : oneDriveFiles;
  const setSelectedFiles =
    activeProvider === 'google-drive' ? setGoogleFiles : setOneDriveFiles;

  const handleGoogleToken = useCallback((token: string) => {
    googleTokenRef.current = token;
  }, []);

  function getDestinationFolderName(): string {
    if (!destinationFolderId) return '/ Root';
    const folder = folders?.find((f) => f.id === destinationFolderId);
    return folder ? folder.name : '/ Root';
  }

  function removeFile(idx: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleImport() {
    if (selectedFiles.length === 0) return;

    const totalBytes = selectedFiles.reduce((sum, f) => sum + f.sizeBytes, 0);

    for (const file of selectedFiles) {
      enqueue({
        dataRoomId,
        folderId: destinationFolderId,
        provider: activeProvider,
        name: file.name,
        sizeBytes: file.sizeBytes,
        mimeType: file.mimeType,
        relativePath: file.relativePath,
        queryClient,
        ...(activeProvider === 'google-drive'
          ? {
              googleFileId: file.googleFileId,
              googleAccessToken: googleTokenRef.current ?? undefined,
            }
          : { oneDriveDownloadUrl: file.oneDriveDownloadUrl }),
      });
    }

    setImportSummary({
      count: selectedFiles.length,
      totalBytes,
      provider: activeProvider,
      folderName: getDestinationFolderName(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className={`relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 ${
          importSummary ? 'w-full max-w-md' : 'w-full max-w-xl'
        }`}
      >
        {/* Header — always visible */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Import from Cloud Storage
            </h2>
            {!importSummary && (
              <p className="mt-0.5 text-xs text-slate-500">
                Files become native VDR documents — no link to the cloud source after import
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {importSummary ? (
          <ImportSummaryScreen summary={importSummary} onClose={onClose} />
        ) : (
          <>
            {/* Provider tabs */}
            <div className="flex border-b border-slate-100">
              {(
                [
                  { id: 'google-drive' as const, label: 'Google Drive' },
                  { id: 'onedrive' as const, label: 'Microsoft OneDrive' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveProvider(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeProvider === tab.id
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Cloud className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable content */}
            <div
              className="flex flex-col gap-4 overflow-y-auto px-6 py-5"
              style={{ maxHeight: 460 }}
            >
              {/* Destination folder */}
              <FolderSelector
                dataRoomId={dataRoomId}
                value={destinationFolderId}
                onChange={setDestinationFolderId}
              />

              <div className="border-t border-slate-100" />

              {/* Provider content */}
              {activeProvider === 'google-drive' ? (
                <GoogleDriveTab
                  selectedFiles={googleFiles}
                  setSelectedFiles={setGoogleFiles}
                  scanning={scanning}
                  setScanning={setScanning}
                  onTokenObtained={handleGoogleToken}
                />
              ) : (
                <OneDriveTab setSelectedFiles={setOneDriveFiles} />
              )}

              {/* Selected files */}
              {selectedFiles.length > 0 && <div className="border-t border-slate-100" />}
              <SelectedFilesList files={selectedFiles} onRemove={removeFile} />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <p className="text-sm text-slate-500">
                {selectedFiles.length > 0 ? (
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} ready
                    &nbsp;&middot;&nbsp;
                    {formatBytes(selectedFiles.reduce((s, f) => s + f.sizeBytes, 0))}
                  </span>
                ) : (
                  'No files selected'
                )}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedFiles.length === 0 || scanning}
                  className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Cloud className="h-4 w-4" aria-hidden="true" />
                  Import
                  {selectedFiles.length > 0
                    ? ` ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`
                    : ''}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

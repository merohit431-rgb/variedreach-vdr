import { create } from 'zustand';

// Folder selection + file search live here (not in page state) because the
// room-scoped Sidebar and the TopNav search box drive the Files page from
// outside the page component. roomId scopes the selection: entering a
// different room resets it (ensureRoom), while re-mounting the Files page of
// the same room keeps a selection that was just made from the Sidebar.
interface WorkspaceState {
  roomId: string | null;
  selectedFolderId: string | null;
  search: string;
  setSelectedFolder: (roomId: string, folderId: string | null) => void;
  setSearch: (value: string) => void;
  ensureRoom: (roomId: string) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  roomId: null,
  selectedFolderId: null,
  search: '',
  setSelectedFolder: (roomId, folderId) =>
    set({ roomId, selectedFolderId: folderId, search: '' }),
  setSearch: (value) => set({ search: value }),
  ensureRoom: (roomId) => {
    if (get().roomId !== roomId) {
      set({ roomId, selectedFolderId: null, search: '' });
    }
  },
  reset: () => set({ roomId: null, selectedFolderId: null, search: '' }),
}));

import { create } from "zustand";
import { readPersistedState, writePersistedState } from "@/lib/db";

type WorkspaceState = {
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  hydrated: false,
  setHydrated: (hydrated) => set({ hydrated })
}));

/** Load and save small workspace preferences without sending data to a server. */
export async function hydrateWorkspace<T>(key: string, fallback: T): Promise<T> {
  const saved = await readPersistedState<T>(key);
  useWorkspaceStore.getState().setHydrated(true);
  return saved ?? fallback;
}

export function persistWorkspace<T>(key: string, value: T) {
  return writePersistedState(key, value);
}

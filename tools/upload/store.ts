import { create } from "zustand";
import type { PhotoEditOperation } from "@/tools/editor/types";
import { readPersistedState, writePersistedState } from "@/lib/db";

export type JointPhotoRecord = { id: string; image: Blob; createdAt: number };

type UploadSession = {
  files: File[];
  selectedAt: number;
  operations: PhotoEditOperation[];
  photoOperations?: Record<number, PhotoEditOperation[]>;
  backgroundResult?: Blob;
  backgroundResults?: Record<number, Blob>;
  backgroundColors?: Record<number, string>;
  jointPhotos?: JointPhotoRecord[];
};

type UploadStore = {
  sessions: Record<string, UploadSession>;
  hydrated: boolean;
  setFiles: (toolId: string, files: File[]) => void;
  setOperations: (toolId: string, operations: PhotoEditOperation[]) => void;
  setPhotoOperations: (toolId: string, photoIndex: number, operations: PhotoEditOperation[]) => void;
  setBackgroundResult: (toolId: string, result: Blob | undefined, photoIndex?: number) => void;
  setBackgroundColor: (toolId: string, color: string | undefined, photoIndex?: number) => void;
  getFiles: (toolId: string) => File[];
  clearFiles: (toolId: string) => void;
  appendFiles: (toolId: string, files: File[]) => void;
  hydrate: () => Promise<void>;
  addJointPhoto: (toolId: string, photo: JointPhotoRecord) => void;
  removeJointPhoto: (toolId: string, photoId: string) => void;
  reorderFiles: (toolId: string, from: number, to: number) => void;
};

const persistSessions = (sessions: Record<string, UploadSession>) => {
  void writePersistedState("upload-sessions", sessions).catch((error) => console.error("Could not persist local photo session", error));
};

export const useUploadStore = create<UploadStore>((set, get) => ({
  sessions: {},
  hydrated: false,
  setFiles: (toolId, files) => set((state) => {
    const sessions = { ...state.sessions, [toolId]: { files, selectedAt: Date.now(), operations: [] } };
    persistSessions(sessions);
    return { sessions };
  }),
  appendFiles: (toolId, files) => set((state) => {
    const existing = state.sessions[toolId];
    const sessions = { ...state.sessions, [toolId]: { files: [...(existing?.files ?? []), ...files], selectedAt: existing?.selectedAt ?? Date.now(), operations: existing?.operations ?? [], photoOperations: existing?.photoOperations, backgroundResult: existing?.backgroundResult, backgroundResults: existing?.backgroundResults, backgroundColors: existing?.backgroundColors, jointPhotos: existing?.jointPhotos ?? [] } };
    persistSessions(sessions);
    return { sessions };
  }),
  setOperations: (toolId, operations) => set((state) => {
    const session = state.sessions[toolId];
    if (!session) return state;
    const sessions = { ...state.sessions, [toolId]: { ...session, operations } };
    persistSessions(sessions);
    return { sessions };
  }),
  setPhotoOperations: (toolId, photoIndex, operations) => set((state) => {
    const session = state.sessions[toolId];
    if (!session) return state;
    const photoOperations = { ...session.photoOperations, [photoIndex]: operations };
    const sessions = { ...state.sessions, [toolId]: { ...session, photoOperations, ...(photoIndex === 0 ? { operations } : {}) } };
    persistSessions(sessions);
    return { sessions };
  }),
  setBackgroundResult: (toolId, backgroundResult, photoIndex = 0) => set((state) => {
    const session = state.sessions[toolId];
    if (!session) return state;
    const backgroundResults = { ...session.backgroundResults };
    if (backgroundResult) backgroundResults[photoIndex] = backgroundResult;
    else delete backgroundResults[photoIndex];
    const sessions = { ...state.sessions, [toolId]: { ...session, backgroundResults, ...(photoIndex === 0 ? { backgroundResult } : {}) } };
    persistSessions(sessions);
    return { sessions };
  }),
  setBackgroundColor: (toolId, color, photoIndex = 0) => set((state) => {
    const session = state.sessions[toolId];
    if (!session) return state;
    const backgroundColors = { ...session.backgroundColors };
    if (color) backgroundColors[photoIndex] = color;
    else delete backgroundColors[photoIndex];
    const sessions = { ...state.sessions, [toolId]: { ...session, backgroundColors } };
    persistSessions(sessions);
    return { sessions };
  }),
  addJointPhoto: (toolId, photo) => set((state) => {
    const session = state.sessions[toolId];
    if (!session) return state;
    const sessions = { ...state.sessions, [toolId]: { ...session, jointPhotos: [...(session.jointPhotos ?? []), photo] } };
    persistSessions(sessions);
    return { sessions };
  }),
  removeJointPhoto: (toolId, photoId) => set((state) => {
    const session = state.sessions[toolId];
    if (!session) return state;
    const sessions = { ...state.sessions, [toolId]: { ...session, jointPhotos: (session.jointPhotos ?? []).filter(({ id }) => id !== photoId) } };
    persistSessions(sessions);
    return { sessions };
  }),
  reorderFiles: (toolId, from, to) => set((state) => {
    const session = state.sessions[toolId];
    if (!session || from < 0 || to < 0 || from >= session.files.length || to >= session.files.length || from === to) return state;
    const files = [...session.files];
    const [file] = files.splice(from, 1);
    files.splice(to, 0, file);
    const indexes = session.files.map((_, index) => index);
    const [movedIndex] = indexes.splice(from, 1);
    indexes.splice(to, 0, movedIndex);
    const photoOperations = Object.fromEntries(indexes.map((oldIndex, newIndex) => [newIndex, session.photoOperations?.[oldIndex] ?? (oldIndex === 0 ? session.operations : undefined)]).filter(([, value]) => value !== undefined)) as Record<number, PhotoEditOperation[]>;
    const backgroundResults = Object.fromEntries(indexes.map((oldIndex, newIndex) => [newIndex, session.backgroundResults?.[oldIndex] ?? (oldIndex === 0 ? session.backgroundResult : undefined)]).filter(([, value]) => value !== undefined)) as Record<number, Blob>;
    const backgroundColors = Object.fromEntries(indexes.map((oldIndex, newIndex) => [newIndex, session.backgroundColors?.[oldIndex]]).filter(([, value]) => value !== undefined)) as Record<number, string>;
    const sessions = { ...state.sessions, [toolId]: { ...session, files, photoOperations, operations: photoOperations[0] ?? [], backgroundResults, backgroundResult: backgroundResults[0], backgroundColors } };
    persistSessions(sessions);
    return { sessions };
  }),
  hydrate: async () => {
    try {
      const persisted = await readPersistedState<Record<string, UploadSession>>("upload-sessions");
      if (persisted) set((state) => ({ sessions: { ...persisted, ...state.sessions }, hydrated: true }));
      else set({ hydrated: true });
    } catch (error) {
      console.error("Could not restore local photo session", error);
      set({ hydrated: true });
    }
  },
  getFiles: (toolId) => get().sessions[toolId]?.files ?? [],
  clearFiles: (toolId) => set((state) => {
    const sessions = { ...state.sessions };
    delete sessions[toolId];
    persistSessions(sessions);
    return { sessions };
  })
}));

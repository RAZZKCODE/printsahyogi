import { create } from "zustand";
import { readPersistedState, writePersistedState } from "@/lib/db";
import type { CardCropConfig } from "@/tools/card-crop/config";
import type { CardCropSettings, ProcessedCard } from "@/tools/card-crop/types";

export type CardCropSession = {
  config: CardCropConfig;
  settings: CardCropSettings;
  cards: ProcessedCard[];
  updatedAt: number;
};

type Store = {
  sessions: Record<string, CardCropSession>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (slug: string, session: CardCropSession) => void;
  updateSettings: (slug: string, settings: CardCropSettings) => void;
  updateCard: (slug: string, cardId: string, patch: Partial<ProcessedCard>) => void;
  appendCards: (slug: string, cards: ProcessedCard[]) => void;
  removeCard: (slug: string, cardId: string) => void;
  clear: (slug: string) => void;
};

const persist = (sessions: Record<string, CardCropSession>) => {
  void writePersistedState("card-crop-sessions", sessions).catch((error) => console.error("Could not persist card crop session", error));
};

export const useCardCropStore = create<Store>((set) => ({
  sessions: {},
  hydrated: false,
  hydrate: async () => {
    try {
      const sessions = await readPersistedState<Record<string, CardCropSession>>("card-crop-sessions");
      set((state) => ({ sessions: { ...sessions, ...state.sessions }, hydrated: true }));
    } catch (error) {
      console.error("Could not restore card crop sessions", error);
      set({ hydrated: true });
    }
  },
  setSession: (slug, session) => set((state) => {
    const sessions = { ...state.sessions, [slug]: { ...session, updatedAt: Date.now() } };
    persist(sessions);
    return { sessions };
  }),
  updateSettings: (slug, settings) => set((state) => {
    const current = state.sessions[slug];
    if (!current) return state;
    const sessions = { ...state.sessions, [slug]: { ...current, settings, updatedAt: Date.now() } };
    persist(sessions);
    return { sessions };
  }),
  updateCard: (slug, cardId, patch) => set((state) => {
    const current = state.sessions[slug];
    if (!current) return state;
    const sessions = { ...state.sessions, [slug]: { ...current, cards: current.cards.map((card) => card.id === cardId ? { ...card, ...patch } : card), updatedAt: Date.now() } };
    persist(sessions);
    return { sessions };
  }),
  appendCards: (slug, cards) => set((state) => {
    const current = state.sessions[slug];
    if (!current) return state;
    const sessions = { ...state.sessions, [slug]: { ...current, cards: [...current.cards, ...cards], updatedAt: Date.now() } };
    persist(sessions);
    return { sessions };
  }),
  removeCard: (slug, cardId) => set((state) => {
    const current = state.sessions[slug];
    if (!current) return state;
    const sessions = { ...state.sessions, [slug]: { ...current, cards: current.cards.filter((card) => card.id !== cardId), updatedAt: Date.now() } };
    persist(sessions);
    return { sessions };
  }),
  clear: (slug) => set((state) => {
    const sessions = { ...state.sessions };
    delete sessions[slug];
    persist(sessions);
    return { sessions };
  })
}));

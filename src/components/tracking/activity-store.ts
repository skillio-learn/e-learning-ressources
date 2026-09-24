"use client";
// Petit store partagé : temps actif local depuis le chargement de la page + état d'inactivité.

type State = { activeSinceLoad: number; idle: boolean };
let state: State = { activeSinceLoad: 0, idle: false };
const listeners = new Set<() => void>();
let flusher: (() => Promise<void>) | null = null;

export const activityStore = {
  get: () => state,
  set(patch: Partial<State>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Envoie immédiatement le temps en attente (avant une validation d'étape). */
  registerFlush(f: (() => Promise<void>) | null) {
    flusher = f;
  },
  async flush() {
    if (flusher) await flusher();
  },
  reset() {
    state = { activeSinceLoad: 0, idle: false };
    listeners.forEach((l) => l());
  },
};

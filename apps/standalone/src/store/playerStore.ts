/**
 * Zustand store for the player. Holds the current queue, current track index,
 * playback state, and exposes actions used by the player bar and pages.
 */
import { create } from 'zustand';
import type { Content } from '@chymusic/shared';

interface PlayerState {
  queue: Content[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  /** Whether smart shuffle is active (modifies the queue as it plays). */
  smartShuffle: boolean;
  /** Repeat mode: 'off' | 'queue' | 'track'. */
  repeat: 'off' | 'queue' | 'track';

  playNow: (content: Content, queue?: Content[]) => void;
  addToQueue: (content: Content) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  toggleSmartShuffle: () => void;
  cycleRepeat: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  volume: 0.8,
  smartShuffle: false,
  repeat: 'off',

  playNow: (content, queue) => {
    const newQueue = queue ?? [content];
    const idx = newQueue.findIndex((c) => c.id === content.id);
    set({ queue: newQueue, currentIndex: idx >= 0 ? idx : 0, isPlaying: true });
  },

  addToQueue: (content) => {
    set((s) => ({ queue: [...s.queue, content] }));
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentIndex, repeat } = get();
    if (queue.length === 0) return;
    let nextIdx = currentIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeat === 'queue') nextIdx = 0;
      else {
        set({ isPlaying: false });
        return;
      }
    }
    set({ currentIndex: nextIdx, isPlaying: true });
  },

  prev: () => {
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    const prevIdx = currentIndex <= 0 ? 0 : currentIndex - 1;
    set({ currentIndex: prevIdx, isPlaying: true });
  },

  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),

  toggleSmartShuffle: () => set((s) => ({ smartShuffle: !s.smartShuffle })),

  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === 'off' ? 'queue' : s.repeat === 'queue' ? 'track' : 'off',
    })),
}));

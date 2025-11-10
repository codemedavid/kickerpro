import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AutoFetchState {
  isEnabled: boolean;
  intervalMs: number;
  toggle: () => void;
  setInterval: (ms: number) => void;
}

export const useAutoFetchStore = create<AutoFetchState>()(
  persist(
    (set) => ({
      isEnabled: false,
      intervalMs: 30000, // 30 seconds default
      toggle: () => set((state) => ({ isEnabled: !state.isEnabled })),
      setInterval: (ms: number) => set({ intervalMs: ms }),
    }),
    {
      name: 'auto-fetch-storage',
    }
  )
);


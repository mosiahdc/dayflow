import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TradeSettings {
  initialBalance: number;
  setInitialBalance: (v: number) => void;
}

export const useTradeSettingsStore = create<TradeSettings>()(
  persist(
    (set) => ({
      initialBalance: 0,
      setInitialBalance: (initialBalance) => set({ initialBalance }),
    }),
    { name: 'dayflow-trade-settings' }
  )
);

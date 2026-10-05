import { create } from 'zustand';

interface SelectionState {
  selectedId: string | null;
  select: (id: string | null) => void;
}

export const useSelection = create<SelectionState>((set) => ({
  selectedId: null,
  select: (selectedId) => set({ selectedId }),
}));

import { create } from "zustand";
import { Commitment } from "@/lib/types";

interface CommitmentsState {
  commitments: Commitment[];
  loading: boolean;
  error: string | null;
  setCommitments: (commitments: Commitment[]) => void;
  addCommitment: (commitment: Commitment) => void;
  updateCommitment: (id: string, updates: Partial<Commitment>) => void;
  deleteCommitment: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useCommitmentsStore = create<CommitmentsState>((set) => ({
  commitments: [],
  loading: false,
  error: null,
  setCommitments: (commitments) => set({ commitments }),
  addCommitment: (commitment) =>
    set((state) => ({ commitments: [commitment, ...state.commitments] })),
  updateCommitment: (id, updates) =>
    set((state) => ({
      commitments: state.commitments.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  deleteCommitment: (id) =>
    set((state) => ({
      commitments: state.commitments.filter((c) => c.id !== id),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

import { create } from "zustand";
import { Commitment } from "@/lib/types";
import { db } from "@/lib/firebase/client";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from "firebase/firestore";

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

  /**
   * Opens a real-time Firestore onSnapshot listener for users/{userId}/commitments.
   * Streams all commitment updates live into the store.
   * Returns the unsubscribe function so callers can tear it down on unmount/logout.
   *
   * Safe to call multiple times — call the returned unsubscribe before re-subscribing
   * to avoid duplicate listeners.
   */
  subscribeToCommitments: (userId: string) => Unsubscribe;
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

  subscribeToCommitments: (userId: string): Unsubscribe => {
    set({ loading: true, error: null });

    const commitmentsRef = collection(
      db,
      "users",
      userId,
      "commitments"
    );

    // Order by createdAt descending so newest commitments appear first
    const q = query(commitmentsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const commitments: Commitment[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Commitment, "id">),
        }));
        set({ commitments, loading: false, error: null });
      },
      (err) => {
        // Firestore permission denied on logout — silence it gracefully
        if (err.code === "permission-denied") {
          set({ loading: false });
          return;
        }
        console.error("[useCommitmentsStore] onSnapshot error:", err.message);
        set({ error: err.message, loading: false });
      }
    );

    return unsubscribe;
  },
}));


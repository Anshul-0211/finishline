import { create } from "zustand";
import { Commitment, firestoreToCommitment } from "@/lib/types/commitment";
import { db } from "@/lib/firebase/client";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
  doc,
  deleteDoc,
} from "firebase/firestore";

interface CommitmentsStoreState {
  commitments: Commitment[];
  loading: boolean;
  error: string | null;

  subscribeToCommitments: (userId: string) => Unsubscribe;
  clearCommitments: () => void;
  updateCommitmentOptimistic: (id: string, fields: Partial<Commitment>) => void;
  deleteCommitment: (userId: string, id: string) => Promise<void>;
}

export const useCommitmentsStore = create<CommitmentsStoreState>((set) => ({
  commitments: [],
  loading: false,
  error: null,

  subscribeToCommitments: (userId: string): Unsubscribe => {
    set({ loading: true, error: null });

    const commitmentsRef = collection(db, "users", userId, "commitments");
    const q = query(commitmentsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const list: Commitment[] = snapshot.docs.map((doc) =>
            firestoreToCommitment(doc)
          );
          set({ commitments: list, loading: false, error: null });
        } catch (err: any) {
          console.error("[useCommitmentsStore] Mapping error:", err);
          set({ error: err.message || "Failed to parse commitments", loading: false });
        }
      },
      (err) => {
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

  clearCommitments: () => {
    set({ commitments: [], loading: false, error: null });
  },

  updateCommitmentOptimistic: (id: string, fields: Partial<Commitment>) => {
    set((state) => ({
      commitments: state.commitments.map((c) =>
        c.id === id ? { ...c, ...fields } : c
      ),
    }));
  },

  deleteCommitment: async (userId: string, id: string) => {
    try {
      const docRef = doc(db, "users", userId, "commitments", id);
      await deleteDoc(docRef);
    } catch (err: any) {
      console.error("[useCommitmentsStore] deleteCommitment error:", err);
      set({ error: err.message || "Failed to delete commitment" });
      throw err;
    }
  },
}));

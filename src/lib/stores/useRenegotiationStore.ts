import { create } from "zustand";

export interface RenegotiationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ProposedScheduleBlock {
  date: string; // ISO 8601 string or date string
  durationMinutes: number;
  goal: string;
}

export interface ProposedSchedule {
  summary: string;
  blocks: ProposedScheduleBlock[];
}

interface RenegotiationState {
  messages: RenegotiationMessage[];
  loading: boolean;
  confirmed: boolean;
  proposedSchedule: ProposedSchedule | null;
  newDeadline: string | null;
  conflictsAvoided: string[];
  error: string | null;

  addMessage: (role: "user" | "assistant" | "system", content: string) => void;
  setLoading: (v: boolean) => void;
  setProposedSchedule: (
    schedule: ProposedSchedule | null,
    newDeadline: string | null,
    conflictsAvoided: string[]
  ) => void;
  setConfirmed: (v: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const initialRenegotiationState = {
  messages: [
    {
      role: "assistant" as const,
      content: "I'm here to help renegotiate this commitment. What's going on?",
    },
  ],
  loading: false,
  confirmed: false,
  proposedSchedule: null,
  newDeadline: null,
  conflictsAvoided: [],
  error: null,
};

export const useRenegotiationStore = create<RenegotiationState>((set) => ({
  ...initialRenegotiationState,

  addMessage: (role, content) =>
    set((state) => ({
      messages: [...state.messages, { role, content }],
    })),

  setLoading: (v) => set({ loading: v }),

  setProposedSchedule: (schedule, newDeadline, conflictsAvoided) =>
    set({ proposedSchedule: schedule, newDeadline, conflictsAvoided }),

  setConfirmed: (v) => set({ confirmed: v }),

  setError: (msg) => set({ error: msg }),

  reset: () => set({ ...initialRenegotiationState }),
}));

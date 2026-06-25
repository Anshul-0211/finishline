import { create } from "zustand";

interface AgentState {
  agentStatus: "idle" | "running" | "failed";
  lastRunTime: any | null; // Timestamp or string
  logs: any[];
  setAgentStatus: (status: "idle" | "running" | "failed") => void;
  setLastRunTime: (time: any) => void;
  setLogs: (logs: any[]) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agentStatus: "idle",
  lastRunTime: null,
  logs: [],
  setAgentStatus: (agentStatus) => set({ agentStatus }),
  setLastRunTime: (lastRunTime) => set({ lastRunTime }),
  setLogs: (logs) => set({ logs }),
}));

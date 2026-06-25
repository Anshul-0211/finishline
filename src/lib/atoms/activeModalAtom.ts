import { atom } from "jotai";

export type ModalType =
  | "none"
  | "add_commitment"
  | "renegotiate"
  | "settings"
  | "weekly_planning"
  | "weekly_reflection";

export const activeModalAtom = atom<ModalType>("none");

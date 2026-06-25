import { atom } from "jotai";

export interface VoiceRecordingState {
  isRecording: boolean;
  duration: number;
  transcript: string;
}

export const voiceRecordingAtom = atom<VoiceRecordingState>({
  isRecording: false,
  duration: 0,
  transcript: "",
});

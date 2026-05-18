export type NoraState =
  | "idle"
  | "scanning"
  | "pointing"
  | "reporting"
  | "sleeping";

export type NoraMood = "neutral" | "alert" | "satisfied" | "displeased";

export type NoraSnapshot = {
  state: NoraState;
  mood: NoraMood;
  utterance: string | null;
};

export const IDLE_SNAPSHOT: NoraSnapshot = {
  state: "idle",
  mood: "neutral",
  utterance: "Nothing to audit yet.",
};

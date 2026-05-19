"use client";

import { useEffect, useState } from "react";

export type AIModel = {
  id: string;
  label: string;
  tag: "fast" | "balanced" | "powerful";
};

export const AI_MODELS: AIModel[] = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", tag: "fast" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", tag: "balanced" },
  { id: "claude-opus-4-7", label: "Opus 4.7", tag: "powerful" },
];

const STORAGE_KEY = "uifa:ai-model:v1";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const EVENT = "uifa:ai-model:changed";

const isBrowser = () => typeof window !== "undefined";

export function getAIModel(): string {
  if (!isBrowser()) return DEFAULT_MODEL;
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MODEL;
}

export function saveAIModel(id: string) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useAIModel() {
  const [model, setModelState] = useState<string>(DEFAULT_MODEL);

  useEffect(() => {
    setModelState(getAIModel());
    const onChange = () => setModelState(getAIModel());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setModel = (id: string) => {
    saveAIModel(id);
    setModelState(id);
  };

  return { model, setModel };
}

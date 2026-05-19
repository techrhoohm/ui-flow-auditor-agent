"use client";

import { AI_MODELS } from "@/lib/ai-model";

type Props = {
  model: string;
  onChange: (id: string) => void;
};

const TAG_STYLE = {
  fast: "text-sky-400",
  balanced: "text-violet-300",
  powerful: "text-amber-300",
};

export function ModelPicker({ model, onChange }: Props) {
  const current = AI_MODELS.find((m) => m.id === model) ?? AI_MODELS[1];

  return (
    <div className="relative flex items-center">
      <span className={`mr-1.5 text-[10px] font-mono ${TAG_STYLE[current.tag]}`}>
        ✦
      </span>
      <select
        value={model}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md border border-zinc-700 bg-zinc-900 py-1 pl-2 pr-6 text-[11px] font-medium text-zinc-200 focus:border-violet-400/50 focus:outline-none"
        title="Choose which model Nora uses for AI assist"
      >
        {AI_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} · {m.tag}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="currentColor"
      >
        <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

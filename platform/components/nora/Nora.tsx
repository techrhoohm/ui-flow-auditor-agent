"use client";

import { motion } from "framer-motion";
import { SpeechBubble } from "./SpeechBubble";
import type { NoraSnapshot } from "./states";

type Props = {
  snapshot: NoraSnapshot;
};

export function Nora({ snapshot }: Props) {
  return (
    <div className="pointer-events-none flex items-end gap-3">
      <div className="pointer-events-auto pb-6">
        <SpeechBubble text={snapshot.utterance} />
      </div>

      <motion.div
        className="pointer-events-auto select-none"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <NoraSilhouette mood={snapshot.mood} />
      </motion.div>
    </div>
  );
}

function NoraSilhouette({ mood }: { mood: NoraSnapshot["mood"] }) {
  const eyeColor =
    mood === "alert"
      ? "#f59e0b"
      : mood === "displeased"
      ? "#f43f5e"
      : mood === "satisfied"
      ? "#34d399"
      : "#a78bfa";

  return (
    <svg
      width="92"
      height="128"
      viewBox="0 0 92 128"
      aria-label="Nora"
      role="img"
      className="drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
    >
      <defs>
        <linearGradient id="cloak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a24" />
          <stop offset="100%" stopColor="#08080c" />
        </linearGradient>
        <radialGradient id="face" cx="0.5" cy="0.45" r="0.55">
          <stop offset="0%" stopColor="#050507" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <filter id="eyeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d="M46 6 C22 10 16 36 20 64 L14 122 Q46 116 78 122 L72 64 C76 36 70 10 46 6 Z"
        fill="url(#cloak)"
        stroke="#2a2a38"
        strokeWidth="0.8"
      />

      <ellipse cx="46" cy="36" rx="20" ry="22" fill="url(#face)" />

      <motion.g
        animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          repeatDelay: 2.3,
          times: [0, 0.45, 0.5, 0.55, 1],
          ease: "easeInOut",
        }}
        style={{ transformOrigin: "46px 36px", transformBox: "fill-box" }}
      >
        <rect
          x="33"
          y="34"
          width="9"
          height="2.4"
          rx="1.2"
          fill={eyeColor}
          filter="url(#eyeGlow)"
        />
        <rect
          x="50"
          y="34"
          width="9"
          height="2.4"
          rx="1.2"
          fill={eyeColor}
          filter="url(#eyeGlow)"
        />
      </motion.g>

      <path
        d="M46 6 C30 8 24 22 24 38"
        fill="none"
        stroke="#2a2a38"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

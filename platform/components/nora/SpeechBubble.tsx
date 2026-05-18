"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
  text: string | null;
};

export function SpeechBubble({ text }: Props) {
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative max-w-[220px] rounded-md border border-zinc-700/80 bg-zinc-900/95 px-3 py-2 text-[13px] leading-snug text-zinc-100 shadow-lg backdrop-blur"
        >
          <span className="font-mono tracking-tight">{text}</span>
          <span
            aria-hidden
            className="absolute -bottom-[6px] left-6 h-3 w-3 rotate-45 border-b border-r border-zinc-700/80 bg-zinc-900/95"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

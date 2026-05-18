"use client";

import { useStore, type ReactFlowState } from "@xyflow/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const NODE_HALF_WIDTH = 74;
const NODE_HALF_HEIGHT = 50;

type Origin = { x: number; y: number };

type Props = {
  activeNodeId: string | null;
  origin: Origin | null;
};

const selectViewport = (s: ReactFlowState) => s.transform;

export function PointingLine({ activeNodeId, origin }: Props) {
  const transform = useStore(selectViewport);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!activeNodeId) {
      setTarget(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${activeNodeId}"]`
    );
    if (!el) {
      setTarget(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setTarget({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, [activeNodeId, transform, size]);

  if (!activeNodeId || !origin || !target) return null;

  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return null;

  const ux = dx / dist;
  const uy = dy / dist;
  const padX = Math.min(Math.abs(ux) * NODE_HALF_WIDTH, NODE_HALF_WIDTH);
  const padY = Math.min(Math.abs(uy) * NODE_HALF_HEIGHT, NODE_HALF_HEIGHT);
  const endX = target.x - ux * padX;
  const endY = target.y - uy * padY;

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-20"
      width={size.w}
      height={size.h}
    >
      <defs>
        <linearGradient id="nora-line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.0" />
          <stop offset="20%" stopColor="#a78bfa" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <motion.line
        x1={origin.x}
        y1={origin.y}
        x2={endX}
        y2={endY}
        stroke="url(#nora-line)"
        strokeWidth={1.25}
        strokeDasharray="4 6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, strokeDashoffset: [0, -20] }}
        transition={{
          opacity: { duration: 0.25 },
          strokeDashoffset: { duration: 1.2, repeat: Infinity, ease: "linear" },
        }}
      />

      <motion.circle
        cx={endX}
        cy={endY}
        r={3}
        fill="#c4b5fd"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  );
}

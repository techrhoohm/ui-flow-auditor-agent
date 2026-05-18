"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NoraSnapshot } from "@/components/nora/states";
import type { AuditEvent, AuditScript, Severity } from "./audit-script";

export type AuditFinding = {
  nodeId: string;
  severity: Severity;
  message: string;
  at: number;
};

export type AuditRunResult = {
  id: string;
  target: string;
  startedAt: number;
  endedAt: number;
  findings: AuditFinding[];
};

export type AuditRunState = {
  running: boolean;
  currentNodeId: string | null;
  progress: { index: number; total: number };
  snapshot: NoraSnapshot;
  flashNodeId: string | null;
  flashSeverity: Severity | null;
};

export type UseAuditRun = AuditRunState & {
  start: (override?: AuditScript) => void;
  stop: () => void;
  prepare: (utterance: string) => void;
  fail: (utterance: string) => void;
  onFinding: (cb: (f: AuditFinding) => void) => () => void;
  onComplete: (cb: (r: AuditRunResult) => void) => () => void;
};

const moodForSeverity = (s: Severity): NoraSnapshot["mood"] =>
  s === "high" ? "displeased" : s === "medium" ? "alert" : "neutral";

const stateForEvent = (e: AuditEvent): NoraSnapshot["state"] => {
  if (e.kind === "scan") return "scanning";
  if (e.kind === "finding") return "pointing";
  if (e.kind === "end") return "reporting";
  return "scanning";
};

const nodeIdForEvent = (e: AuditEvent): string | null => {
  if (e.kind === "scan" || e.kind === "finding") return e.nodeId;
  return null;
};

const IDLE: NoraSnapshot = {
  state: "idle",
  mood: "neutral",
  utterance: "Nothing to audit yet.",
};

export function useAuditRun(script: AuditScript): UseAuditRun {
  const [state, setState] = useState<AuditRunState>({
    running: false,
    currentNodeId: null,
    progress: { index: 0, total: script.events.length },
    snapshot: IDLE,
    flashNodeId: null,
    flashSeverity: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  const findingListeners = useRef(new Set<(f: AuditFinding) => void>());
  const completeListeners = useRef(new Set<(r: AuditRunResult) => void>());

  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
  };

  useEffect(() => clearTimers, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    clearTimers();
    setState((s) => ({
      ...s,
      running: false,
      currentNodeId: null,
      snapshot: IDLE,
      flashNodeId: null,
      flashSeverity: null,
      progress: { index: 0, total: script.events.length },
    }));
  }, [script.events.length]);

  const prepare = useCallback((utterance: string) => {
    stoppedRef.current = false;
    clearTimers();
    setState((s) => ({
      ...s,
      running: true,
      currentNodeId: null,
      progress: { index: 0, total: 0 },
      snapshot: { state: "scanning", mood: "neutral", utterance },
      flashNodeId: null,
      flashSeverity: null,
    }));
  }, []);

  const fail = useCallback((utterance: string) => {
    stoppedRef.current = true;
    clearTimers();
    setState((s) => ({
      ...s,
      running: false,
      currentNodeId: null,
      snapshot: { state: "reporting", mood: "displeased", utterance },
      flashNodeId: null,
      flashSeverity: null,
      progress: { index: 0, total: 0 },
    }));
  }, []);

  const start = useCallback(
    (override?: AuditScript) => {
      const activeScript = override ?? script;
      stoppedRef.current = false;
      const startedAt = Date.now();
      const findings: AuditFinding[] = [];

    setState({
      running: true,
      currentNodeId: null,
      progress: { index: 0, total: activeScript.events.length },
      snapshot: {
        state: "scanning",
        mood: "neutral",
        utterance:
          activeScript.events[0]?.kind === "start"
            ? activeScript.events[0].utterance
            : "",
      },
      flashNodeId: null,
      flashSeverity: null,
    });

    const runEvent = (i: number) => {
      if (stoppedRef.current) return;
      if (i >= activeScript.events.length) {
        const result: AuditRunResult = {
          id: `run-${startedAt}`,
          target: activeScript.target,
          startedAt,
          endedAt: Date.now(),
          findings,
        };
        completeListeners.current.forEach((cb) => cb(result));
        timerRef.current = setTimeout(() => {
          if (stoppedRef.current) return;
          setState((s) => ({
            ...s,
            running: false,
            currentNodeId: null,
            snapshot: IDLE,
            flashNodeId: null,
            flashSeverity: null,
          }));
        }, 2000);
        return;
      }

      const ev = activeScript.events[i];
      const mood: NoraSnapshot["mood"] =
        ev.kind === "finding"
          ? moodForSeverity(ev.severity)
          : ev.kind === "end"
          ? "satisfied"
          : "neutral";

      setState((s) => ({
        ...s,
        currentNodeId: nodeIdForEvent(ev) ?? s.currentNodeId,
        progress: { index: i + 1, total: activeScript.events.length },
        snapshot: {
          state: stateForEvent(ev),
          mood,
          utterance: ev.utterance,
        },
      }));

      if (ev.kind === "finding") {
        const finding: AuditFinding = {
          nodeId: ev.nodeId,
          severity: ev.severity,
          message: ev.utterance,
          at: Date.now(),
        };
        findings.push(finding);
        findingListeners.current.forEach((cb) => cb(finding));

        setState((s) => ({
          ...s,
          flashNodeId: ev.nodeId,
          flashSeverity: ev.severity,
        }));
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => {
          setState((s) => ({ ...s, flashNodeId: null, flashSeverity: null }));
        }, 700);
      }

      timerRef.current = setTimeout(() => runEvent(i + 1), ev.durationMs);
    };

      runEvent(0);
    },
    [script]
  );

  const onFinding = useCallback((cb: (f: AuditFinding) => void) => {
    findingListeners.current.add(cb);
    return () => {
      findingListeners.current.delete(cb);
    };
  }, []);

  const onComplete = useCallback((cb: (r: AuditRunResult) => void) => {
    completeListeners.current.add(cb);
    return () => {
      completeListeners.current.delete(cb);
    };
  }, []);

  return { ...state, start, stop, prepare, fail, onFinding, onComplete };
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import {
  SCRIPT_CATEGORIES,
  SCRIPT_TEMPLATES,
  TC_CATEGORIES,
  TC_TEMPLATES,
  type ScriptTemplate,
  type TCTemplate,
} from "@/lib/test-templates";
import type { Priority, TestType } from "@/lib/test-cases";

// ─── Types ────────────────────────────────────────────────────────────────────

type TCAddItem = { title: string; body: string; priority: Priority; type: TestType };
type ScriptAddItem = { name: string; body: string };

type Props =
  | { mode: "cases"; onAdd: (items: TCAddItem[]) => void; onClose: () => void }
  | { mode: "scripts"; onAdd: (items: ScriptAddItem[]) => void; onClose: () => void };

type TCCustom = Partial<TCAddItem>;
type ScriptCustom = Partial<ScriptAddItem>;

// ─── Style helpers ────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<Priority, string> = {
  P0: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  P1: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  P2: "border-zinc-700 bg-zinc-900 text-zinc-300",
};

const TYPE_STYLE: Record<TestType, string> = {
  functional: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  visual: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  a11y: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  perf: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
};

const TYPE_LABEL: Record<TestType, string> = {
  functional: "Functional",
  visual: "Visual",
  a11y: "A11y",
  perf: "Perf",
};

const PRIORITY_OPTIONS: Priority[] = ["P0", "P1", "P2"];
const TYPE_OPTIONS: TestType[] = ["functional", "visual", "a11y", "perf"];

const MIN_PREVIEW_H = 160;
const MAX_PREVIEW_H = 520;
const DEFAULT_PREVIEW_H = 280;

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplatePicker(props: Props) {
  const { mode, onClose } = props;
  const isCases = mode === "cases";

  const allCategories = isCases ? (["All", ...TC_CATEGORIES] as string[]) : (["All", ...SCRIPT_CATEGORIES] as string[]);
  const allTemplates = isCases ? TC_TEMPLATES : SCRIPT_TEMPLATES;

  const [category, setCategory] = useState<string>("All");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [tcCustom, setTcCustom] = useState<Map<string, TCCustom>>(new Map());
  const [scriptCustom, setScriptCustom] = useState<Map<string, ScriptCustom>>(new Map());
  const [previewHeight, setPreviewHeight] = useState(DEFAULT_PREVIEW_H);
  const previewRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () =>
      category === "All"
        ? allTemplates
        : allTemplates.filter((t) => t.category === category),
    [allTemplates, category]
  );

  const focused = allTemplates.find((t) => t.id === focusedId) ?? null;
  const checkedCount = checked.size;

  // ── Drag-to-resize ───────────────────────────────────────────────────────

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = previewRef.current?.offsetHeight ?? previewHeight;

    const onMove = (ev: MouseEvent) => {
      const h = Math.max(MIN_PREVIEW_H, Math.min(MAX_PREVIEW_H, startH - (ev.clientY - startY)));
      if (previewRef.current) previewRef.current.style.height = `${h}px`;
    };
    const onUp = (ev: MouseEvent) => {
      const h = Math.max(MIN_PREVIEW_H, Math.min(MAX_PREVIEW_H, startH - (ev.clientY - startY)));
      setPreviewHeight(h);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleTouchDragStart(e: React.TouchEvent) {
    const startY = e.touches[0].clientY;
    const startH = previewRef.current?.offsetHeight ?? previewHeight;

    const onMove = (ev: TouchEvent) => {
      const h = Math.max(MIN_PREVIEW_H, Math.min(MAX_PREVIEW_H, startH - (ev.touches[0].clientY - startY)));
      if (previewRef.current) previewRef.current.style.height = `${h}px`;
    };
    const onEnd = (ev: TouchEvent) => {
      const t = ev.changedTouches[0];
      const h = Math.max(MIN_PREVIEW_H, Math.min(MAX_PREVIEW_H, startH - (t.clientY - startY)));
      setPreviewHeight(h);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  }

  // ── Edit draft for the focused template ──────────────────────────────────

  function getFocusedDraft(): { title?: string; name?: string; body: string; priority?: Priority; type?: TestType } | null {
    if (!focused) return null;
    if (isCases) {
      const base = focused as TCTemplate;
      const custom = tcCustom.get(focused.id);
      return {
        title: custom?.title ?? base.title,
        body: custom?.body ?? base.body,
        priority: custom?.priority ?? base.priority,
        type: custom?.type ?? base.type,
      };
    } else {
      const base = focused as ScriptTemplate;
      const custom = scriptCustom.get(focused.id);
      return {
        name: custom?.name ?? base.name,
        body: custom?.body ?? base.body,
      };
    }
  }

  function updateFocusedTitle(val: string) {
    if (!focusedId || !isCases) return;
    setTcCustom((prev) => {
      const next = new Map(prev);
      next.set(focusedId, { ...next.get(focusedId), title: val });
      return next;
    });
  }

  function updateFocusedName(val: string) {
    if (!focusedId || isCases) return;
    setScriptCustom((prev) => {
      const next = new Map(prev);
      next.set(focusedId, { ...next.get(focusedId), name: val });
      return next;
    });
  }

  function updateFocusedBody(val: string) {
    if (!focusedId) return;
    if (isCases) {
      setTcCustom((prev) => {
        const next = new Map(prev);
        next.set(focusedId, { ...next.get(focusedId), body: val });
        return next;
      });
    } else {
      setScriptCustom((prev) => {
        const next = new Map(prev);
        next.set(focusedId, { ...next.get(focusedId), body: val });
        return next;
      });
    }
  }

  function updateFocusedPriority(val: Priority) {
    if (!focusedId || !isCases) return;
    setTcCustom((prev) => {
      const next = new Map(prev);
      next.set(focusedId, { ...next.get(focusedId), priority: val });
      return next;
    });
  }

  function updateFocusedType(val: TestType) {
    if (!focusedId || !isCases) return;
    setTcCustom((prev) => {
      const next = new Map(prev);
      next.set(focusedId, { ...next.get(focusedId), type: val });
      return next;
    });
  }

  function resetFocusedEdits() {
    if (!focusedId) return;
    if (isCases) {
      setTcCustom((prev) => { const next = new Map(prev); next.delete(focusedId); return next; });
    } else {
      setScriptCustom((prev) => { const next = new Map(prev); next.delete(focusedId); return next; });
    }
  }

  function hasCustomization(id: string) {
    return isCases ? tcCustom.has(id) : scriptCustom.has(id);
  }

  // ── Selection helpers ────────────────────────────────────────────────────

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function focusTemplate(id: string) {
    setFocusedId((prev) => (prev === id ? null : id));
    setChecked((prev) => { const next = new Set(prev); next.add(id); return next; });
  }

  function selectAll() { setChecked(new Set(visible.map((t) => t.id))); }

  function clearAll() {
    setChecked((prev) => {
      const next = new Set(prev);
      visible.forEach((t) => next.delete(t.id));
      return next;
    });
  }

  const allVisibleChecked = visible.length > 0 && visible.every((t) => checked.has(t.id));

  // ── Add ──────────────────────────────────────────────────────────────────

  function handleAdd() {
    if (isCases) {
      const items: TCAddItem[] = [];
      checked.forEach((id) => {
        const template = TC_TEMPLATES.find((t) => t.id === id);
        if (!template) return;
        const custom = tcCustom.get(id);
        items.push({
          title: custom?.title ?? template.title,
          body: custom?.body ?? template.body,
          priority: custom?.priority ?? template.priority,
          type: custom?.type ?? template.type,
        });
      });
      (props as { mode: "cases"; onAdd: (items: TCAddItem[]) => void }).onAdd(items);
    } else {
      const items: ScriptAddItem[] = [];
      checked.forEach((id) => {
        const template = SCRIPT_TEMPLATES.find((t) => t.id === id);
        if (!template) return;
        const custom = scriptCustom.get(id);
        items.push({
          name: custom?.name ?? template.name,
          body: custom?.body ?? template.body,
        });
      });
      (props as { mode: "scripts"; onAdd: (items: ScriptAddItem[]) => void }).onAdd(items);
    }
    onClose();
  }

  const draft = getFocusedDraft();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-sm" onClick={onClose} />

      {/* Modal card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18 }}
        className="relative z-10 flex w-full max-w-2xl flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        style={{ maxHeight: "88vh" }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-semibold text-zinc-100">
              {isCases ? "Test Case Templates" : "Script Templates"}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                isCases
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-300"
              }`}
            >
              {allTemplates.length} templates
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 transition-colors hover:text-zinc-200"
            aria-label="Close template picker"
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Category pills ──────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-zinc-800 px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {allCategories.map((cat) => {
              const count = cat === "All" ? allTemplates.length : allTemplates.filter((t) => t.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setCategory(cat); setFocusedId(null); }}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    category === cat
                      ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {cat} <span className="opacity-50">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Body: list (top) + resizable preview (bottom) ──────────────── */}
        <div className="flex min-h-0 flex-1 flex-col">

          {/* Template list — always visible, scrollable */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Sub-header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-4 py-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {visible.length} template{visible.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={allVisibleChecked ? clearAll : selectAll}
                className="text-[10px] font-medium text-zinc-500 hover:text-zinc-200"
              >
                {allVisibleChecked ? "Deselect all" : "Select all"}
              </button>
            </div>

            {/* Cards */}
            <ul className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1">
              {visible.map((t) => {
                const isChecked = checked.has(t.id);
                const isFocused = focusedId === t.id;
                const isCustomized = hasCustomization(t.id);
                const tc = isCases ? (t as TCTemplate) : null;
                const sc = isCases ? null : (t as ScriptTemplate);

                return (
                  <li key={t.id}>
                    <div
                      className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer ${
                        isFocused
                          ? "border-violet-400/40 bg-violet-500/10"
                          : isChecked
                          ? "border-zinc-700 bg-zinc-900/80"
                          : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700"
                      }`}
                      onClick={() => focusTemplate(t.id)}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                        className="mt-0.5 shrink-0"
                        aria-label={isChecked ? "Deselect template" : "Select template"}
                      >
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                            isChecked ? "border-violet-400 bg-violet-500/25" : "border-zinc-700 bg-zinc-900"
                          }`}
                        >
                          {isChecked && (
                            <svg width="8" height="6" viewBox="0 0 8 6">
                              <path d="M1 3l2 2 4-4" stroke="#a78bfa" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </button>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <p className={`text-[12px] font-medium leading-snug ${isFocused ? "text-violet-200" : "text-zinc-100"}`}>
                            {tc ? tc.title : sc?.name}
                          </p>
                          <div className="flex shrink-0 items-center gap-1 mt-0.5">
                            {isCustomized && (
                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] font-medium text-amber-300">
                                edited
                              </span>
                            )}
                            <svg
                              width="10" height="10" viewBox="0 0 10 10"
                              className={`transition-colors ${isFocused ? "text-violet-400" : "text-zinc-600"}`}
                            >
                              <path d="M3 5h4M5 3l2 2-2 2" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-zinc-500">{t.category}</span>
                          {tc && (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span className={`rounded-full border px-1.5 py-px text-[9px] font-mono ${PRIORITY_STYLE[tc.priority]}`}>{tc.priority}</span>
                              <span className={`rounded-full border px-1.5 py-px text-[9px] ${TYPE_STYLE[tc.type]}`}>{TYPE_LABEL[tc.type]}</span>
                            </>
                          )}
                          {sc && <span className="text-[10px] text-zinc-500 truncate">{sc.description}</span>}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Resizable preview panel ─────────────────────────────────── */}
          <AnimatePresence>
            {focused && draft && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                ref={previewRef}
                style={{ height: previewHeight }}
                className="shrink-0 flex flex-col overflow-hidden border-t border-zinc-800"
              >
                {/* Drag handle — like VS Code panel */}
                <div
                  className="group flex h-[10px] shrink-0 cursor-row-resize items-center justify-center bg-zinc-900/80 hover:bg-violet-500/10 transition-colors select-none"
                  onMouseDown={handleDragStart}
                  onTouchStart={handleTouchDragStart}
                  title="Drag to resize"
                >
                  <div className="h-0.5 w-10 rounded-full bg-zinc-700 transition-colors group-hover:bg-violet-400/50" />
                </div>

                {/* Panel header */}
                <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/40 px-4 py-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Edit before adding
                  </span>
                  <div className="flex items-center gap-2">
                    {hasCustomization(focused.id) && (
                      <button type="button" onClick={resetFocusedEdits} className="text-[10px] text-zinc-500 hover:text-zinc-300">
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFocusedId(null)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors"
                      aria-label="Close preview"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Scrollable edit fields */}
                <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4 min-h-0">
                  {isCases && "title" in draft && (
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Title</label>
                      <input
                        type="text"
                        value={draft.title ?? ""}
                        onChange={(e) => updateFocusedTitle(e.target.value)}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[12px] font-medium text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
                      />
                    </div>
                  )}
                  {!isCases && "name" in draft && (
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Name</label>
                      <input
                        type="text"
                        value={draft.name ?? ""}
                        onChange={(e) => updateFocusedName(e.target.value)}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[12px] font-medium text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
                      />
                    </div>
                  )}

                  {isCases && "priority" in draft && "type" in draft && (
                    <div className="flex flex-wrap gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Priority</label>
                        <div className="flex gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
                          {PRIORITY_OPTIONS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => updateFocusedPriority(p)}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-medium transition-colors ${
                                draft.priority === p ? "bg-violet-500/15 text-violet-200" : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Type</label>
                        <div className="flex flex-wrap gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
                          {TYPE_OPTIONS.map((tp) => (
                            <button
                              key={tp}
                              type="button"
                              onClick={() => updateFocusedType(tp)}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                draft.type === tp ? "bg-violet-500/15 text-violet-200" : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              {TYPE_LABEL[tp]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-1 flex-col">
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
                      {isCases ? "Steps & expected outcome" : "Script body"}
                    </label>
                    <textarea
                      value={draft.body}
                      onChange={(e) => updateFocusedBody(e.target.value)}
                      spellCheck={!isCases}
                      className="min-h-[80px] flex-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-200 focus:border-violet-400/50 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setChecked((prev) => { const next = new Set(prev); next.add(focused.id); return next; })}
                    className="shrink-0 w-full rounded-md border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  >
                    {checked.has(focused.id) ? "✓ Selected for adding" : "Select this template"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-t border-zinc-800 px-5 py-3">
          <p className="text-[11px] text-zinc-500">
            {checkedCount === 0
              ? "No templates selected"
              : `${checkedCount} template${checkedCount !== 1 ? "s" : ""} selected`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={checkedCount === 0}
              className="rounded-md border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-[11px] font-medium text-violet-200 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              Add {checkedCount > 0 ? `${checkedCount} ` : ""}selected
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

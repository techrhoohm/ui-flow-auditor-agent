'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ManualAnnotation } from '@/lib/annotations';

/* ── constants ────────────────────────────────────────────────────── */

const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];
const BASE_W = 900; // base frame width in px at zoom 1×

type Tool = 'rect' | 'ellipse';
type Draft = { shape: Tool; x: number; y: number; w: number; h: number };

/* ── helpers ──────────────────────────────────────────────────────── */

function ShapeView({
  ann, selected, onSelect,
}: {
  ann: ManualAnnotation;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const sw = selected ? 0.65 : 0.4;
  const da = '2 1';
  const fill = selected ? ann.color : 'none';
  const fillOp = selected ? 0.1 : 0;
  const shared = { fill, fillOpacity: fillOp, stroke: ann.color, strokeWidth: sw, strokeDasharray: da };
  const onClick = (e: React.MouseEvent) => { e.stopPropagation(); onSelect(ann.id); };

  if (ann.shape === 'rect') {
    return (
      <g onClick={onClick} style={{ cursor: 'pointer' }}>
        <rect x={ann.x} y={ann.y} width={ann.w} height={ann.h} rx={0.4} {...shared} />
        {ann.label && (
          <text x={ann.x + 0.5} y={ann.y - 0.8}
            fill={ann.color} fontSize={2.6} fontFamily="ui-monospace,monospace" fontWeight="700"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {ann.label}
          </text>
        )}
      </g>
    );
  }
  const cx = ann.x + ann.w / 2, cy = ann.y + ann.h / 2;
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <ellipse cx={cx} cy={cy} rx={ann.w / 2} ry={ann.h / 2} {...shared} />
      {ann.label && (
        <text x={ann.x + ann.w + 0.5} y={ann.y + 3}
          fill={ann.color} fontSize={2.6} fontFamily="ui-monospace,monospace" fontWeight="700"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {ann.label}
        </text>
      )}
    </g>
  );
}

function DraftView({ d, color }: { d: Draft; color: string }) {
  const shared = { fill: 'none', stroke: color, strokeWidth: 0.35, strokeDasharray: '2 1', strokeOpacity: 0.75, style: { pointerEvents: 'none' as const } };
  if (d.shape === 'rect') return <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={0.4} {...shared} />;
  return <ellipse cx={d.x + d.w / 2} cy={d.y + d.h / 2} rx={d.w / 2} ry={d.h / 2} {...shared} />;
}

/* ── main component ───────────────────────────────────────────────── */

interface Props {
  imageUrl?: string;
  wireframeSvg?: string;
  mode: 'screenshot' | 'wireframe';
  nodeLabel: string;
  initial: ManualAnnotation[];
  onSave: (annotations: ManualAnnotation[]) => void;
  onClose: () => void;
}

export function AnnotationEditor({ imageUrl, wireframeSvg, mode, nodeLabel, initial, onSave, onClose }: Props) {
  const [shapes, setShapes] = useState<ManualAnnotation[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [color, setColor] = useState(PALETTE[3]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<ManualAnnotation[][]>([initial]);
  const [editorZoom, setEditorZoom] = useState(1);   // 1 = 100%

  /* pending annotation waiting for label */
  const [pending, setPending] = useState<ManualAnnotation | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');
  const labelInputRef = useRef<HTMLInputElement>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);

  /* focus label input when pending shape is created */
  useEffect(() => {
    if (pending) setTimeout(() => labelInputRef.current?.focus(), 20);
  }, [pending]);

  /* Block ALL wheel events over the full-screen overlay (prevents browser page-zoom).
     Only update editorZoom when the pointer is over the stage area. */
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!stageRef.current?.contains(e.target as Node)) return;
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setEditorZoom(z => Math.max(0.2, Math.min(5, z * factor)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  /* coordinate conversion: mouse → SVG 0–100 % space */
  const toLocal = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return null;
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e as MouseEvent).clientX - r.left) / r.width * 100)),
      y: Math.max(0, Math.min(100, ((e as MouseEvent).clientY - r.top) / r.height * 100)),
    };
  }, []);

  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (pending) return;
    e.preventDefault();
    setSelectedId(null);
    const p = toLocal(e);
    if (!p) return;
    originRef.current = p;
    isDrawing.current = true;
    setDraft({ shape: tool, x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!isDrawing.current || !originRef.current) return;
    const p = toLocal(e);
    if (!p) return;
    const { x: ox, y: oy } = originRef.current;
    setDraft({ shape: tool, x: Math.min(ox, p.x), y: Math.min(oy, p.y), w: Math.abs(p.x - ox), h: Math.abs(p.y - oy) });
  }

  function onMouseUp() {
    isDrawing.current = false;
    if (!draft || draft.w < 0.5 || draft.h < 0.5) { setDraft(null); return; }
    setPending({ id: `a${Date.now()}`, shape: draft.shape, x: draft.x, y: draft.y, w: draft.w, h: draft.h, color, label: '' });
    setPendingLabel('');
    setDraft(null);
  }

  function commitPending() {
    if (!pending) return;
    const ann = { ...pending, label: pendingLabel.trim() };
    setShapes(prev => { const u = [...prev, ann]; setHistory(h => [...h, u]); return u; });
    setPending(null);
    setPendingLabel('');
  }

  function cancelPending() { setPending(null); setPendingLabel(''); }

  function undo() {
    setHistory(h => {
      if (h.length <= 1) return h;
      const prev = h[h.length - 2];
      setShapes(prev);
      return h.slice(0, -1);
    });
    setSelectedId(null);
  }

  function removeSelected() {
    if (!selectedId) return;
    setShapes(prev => { const u = prev.filter(s => s.id !== selectedId); setHistory(h => [...h, u]); return u; });
    setSelectedId(null);
  }

  /* keyboard shortcuts */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
      if (e.key.toLowerCase() === 'r') setTool('rect');
      if (e.key.toLowerCase() === 'e') setTool('ellipse');
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, onClose]);

  const bgLabel = mode === 'screenshot' ? 'Screenshot' : 'Wireframe';
  const zoomPct = Math.round(editorZoom * 100);
  const frameWidth = Math.round(BASE_W * editorZoom);

  /* label popup: appear to the right (or left when near right edge) */
  const labelPopupStyle: React.CSSProperties = pending ? (
    pending.x + pending.w > 65
      ? { right: `${100 - pending.x + 0.5}%`, top: `${pending.y}%` }
      : { left: `${pending.x + pending.w + 0.5}%`, top: `${pending.y}%` }
  ) : {};

  return (
    <div className="anneditor-overlay" ref={overlayRef} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="anneditor-modal">

        {/* ── toolbar ─────────────────────────────────────────────── */}
        <div className="anneditor-bar">
          <span className="anneditor-title">{nodeLabel} · {bgLabel}</span>
          <div className="anneditor-sep" />

          {/* shape tools */}
          <button className={'anntool' + (tool === 'rect' ? ' on' : '')} onClick={() => setTool('rect')} title="Rectangle (R)">
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <rect x="1" y="1" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 1.5"/>
            </svg>
          </button>
          <button className={'anntool' + (tool === 'ellipse' ? ' on' : '')} onClick={() => setTool('ellipse')} title="Ellipse (E)">
            <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
              <ellipse cx="8" cy="7" rx="7" ry="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 1.5"/>
            </svg>
          </button>
          <div className="anneditor-sep" />

          {/* color palette */}
          <div className="annpalette">
            {PALETTE.map(c => (
              <button key={c} className={'anncolor' + (color === c ? ' on' : '')} style={{ background: c }}
                onClick={() => setColor(c)} title={c} />
            ))}
          </div>
          <div className="anneditor-sep" />

          {/* zoom controls */}
          <button className="annbtn" onClick={() => setEditorZoom(z => Math.max(0.2, z / 1.25))} title="Zoom out">−</button>
          <span className="ann-zoom-val">{zoomPct}%</span>
          <button className="annbtn" onClick={() => setEditorZoom(z => Math.min(5, z * 1.25))} title="Zoom in">+</button>
          <button className="annbtn" onClick={() => setEditorZoom(1)} title="Reset zoom">Fit</button>
          <div className="anneditor-sep" />

          {/* actions */}
          <button className="annbtn" onClick={undo} disabled={history.length <= 1} title="Undo (⌘Z)">Undo</button>
          <button className="annbtn" onClick={removeSelected} disabled={!selectedId} title="Remove selected (Del)">Remove</button>
          <button className="annbtn" onClick={() => { setShapes([]); setHistory([[]]); setSelectedId(null); }} disabled={shapes.length === 0}>Clear</button>

          <div style={{ flex: 1 }} />
          <button className="annbtn" onClick={onClose}>Cancel</button>
          <button className="annbtn annbtn-save" onClick={() => { commitPending(); onSave(shapes); onClose(); }}>Save</button>
        </div>

        {/* ── stage ───────────────────────────────────────────────── */}
        <div className="anneditor-stage" ref={stageRef} onClick={() => setSelectedId(null)}>
          {/* frame width drives zoom — image + SVG fill 100% of frame */}
          <div className="anneditor-frame" style={{ width: frameWidth }}>

            {mode === 'screenshot' && imageUrl && (
              <img src={imageUrl} className="anneditor-bg-img" draggable={false} alt="" />
            )}
            {mode === 'wireframe' && wireframeSvg && (
              <div className="anneditor-bg-wire" dangerouslySetInnerHTML={{ __html: wireframeSvg }} />
            )}
            {!imageUrl && !wireframeSvg && (
              <div className="anneditor-empty">No content to annotate</div>
            )}

            {/* drawing SVG overlay */}
            <svg ref={svgRef} className="anneditor-svg" viewBox="0 0 100 100" preserveAspectRatio="none"
              onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
              {shapes.map(s => (
                <ShapeView key={s.id} ann={s} selected={s.id === selectedId} onSelect={setSelectedId} />
              ))}
              {pending && <ShapeView ann={pending} selected={true} onSelect={() => {}} />}
              {draft && <DraftView d={draft} color={color} />}
            </svg>

            {/* inline label input — appears beside the freshly drawn shape */}
            {pending && (
              <div className="ann-label-popup" style={labelPopupStyle}>
                <input ref={labelInputRef} className="ann-label-popup-input"
                  placeholder="label…" maxLength={32}
                  value={pendingLabel} onChange={e => setPendingLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitPending(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelPending(); }
                  }}
                  onBlur={commitPending}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── hint bar ────────────────────────────────────────────── */}
        <div className="anneditor-hints">
          <kbd>R</kbd> rect &nbsp;·&nbsp; <kbd>E</kbd> ellipse &nbsp;·&nbsp;
          click shape to select &nbsp;·&nbsp; <kbd>Del</kbd> remove &nbsp;·&nbsp;
          <kbd>⌘Z</kbd> undo &nbsp;·&nbsp; scroll to zoom &nbsp;·&nbsp; <kbd>Esc</kbd> close
        </div>
      </div>
    </div>
  );
}

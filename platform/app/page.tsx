'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  IcGlobe, IcLock, IcFolder, IcCaret, IcAgent, IcExport,
  IcPlus, IcMinus, IcMaximize, IcClose, IcSun, IcMoon,
  IcSearch, IcChevronRight, IcPlay, IcSpark, IcCamera, IcLayers, IcTarget,
} from '@/components/icons';
import { NodeThumb } from '@/components/canvas/NodeThumb';
import { getScreenshotForNode } from '@/components/canvas/screenshots';
import { getWireframeForNode } from '@/components/canvas/wireframes';
import type { TreeNode, HistoryItem, AgentSite } from '@/lib/prototype-data';
import { SITE_TREE, HISTORY, FINDINGS, AGENT_RUN } from '@/lib/prototype-data';
import { makeTreeForUrl, bfsOrder, extractHost } from '@/lib/prototype-crawl';
import { dbGet, dbSet, dbGetAll } from '@/lib/db';
import type { ClickableElement } from '@/lib/url-crawler';
import type { ManualAnnotation } from '@/lib/annotations';
import { AnnotationEditor } from '@/components/canvas/AnnotationEditor';

/* ─────────────────────────── local types ─────────────────────────────── */

interface RealFinding {
  nodeId: string;
  nodeLabel: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  rule: string;
}

// Shape returned by /api/agent/run  (distinct from prototype-data AgentRun)
interface BackendRun {
  runId: string;
  state: string;
  url: string;
  targetId: string;
  startedAt: number;
  updatedAt: number;
  pagesFound: number;
  issuesFound: number;
  issuesFiled: number;
  log: string[];
  error?: string;
  partialCrawl?: Array<{ id: string; label: string; url: string; screenshot: string | null }>;
  crawlResult?: {
    nodes: Array<{ id: string; label: string; url: string; position: { x: number; y: number }; screenshot: string | null }>;
    edges: Array<{ source: string; target: string }>;
    findings: Array<{ nodeId: string; nodeLabel: string; severity: string; message: string; rule: string }>;
    aiSummary?: string;
  };
}

interface UITarget {
  id: string; url: string; name: string; env: string; state: 'green' | 'amber' | 'red';
}

interface StoredSession {
  session: Session;
  screenshotMap: Record<string, string>;
  wireframeMap: Record<string, string>;
  videoMap: Record<string, string>;
  realFindings: RealFinding[];
  elementMap: Record<string, ClickableElement[]>;
  annotationsMap: Record<string, ManualAnnotation[]>;
}

/* ─────────────────────────── helpers ─────────────────────────────────── */

function findNodeInTree(tree: TreeNode, id: string): TreeNode | null {
  if (!tree) return null;
  if (tree.id === id) return tree;
  for (const c of tree.children || []) {
    const r = findNodeInTree(c, id);
    if (r) return r;
  }
  return null;
}

function countDefects(node: TreeNode) {
  let pages = 0, findings = 0;
  function walk(n: TreeNode) {
    pages++;
    findings += n.defects.ux + n.defects.ui + n.defects.a11y;
    (n.children || []).forEach(walk);
  }
  walk(node);
  return { pages, findings };
}

function buildTreeFromApiNodes(
  apiNodes: Array<{ id: string; label: string; kind: string; url: string }>,
  edges: Array<{ source: string; target: string }>,
  script: { events: Array<{ kind: string; nodeId?: string; severity?: string }> }
): TreeNode {
  const defectsMap: Record<string, { ux: number; ui: number; a11y: number }> = {};
  for (const e of script.events) {
    if (e.kind === 'finding' && e.nodeId) {
      if (!defectsMap[e.nodeId]) defectsMap[e.nodeId] = { ux: 0, ui: 0, a11y: 0 };
      if (e.severity === 'high') defectsMap[e.nodeId].ux++;
      else if (e.severity === 'medium') defectsMap[e.nodeId].ui++;
      else defectsMap[e.nodeId].a11y++;
    }
  }
  const nodeMap = new Map<string, TreeNode>();
  for (const n of apiNodes) {
    let path = '/';
    try { path = new URL(n.url).pathname || '/'; } catch { /* keep '/' */ }
    const tag = n.kind === 'entry' ? 'Entry' : n.kind === 'tab' ? 'Section' : 'Page';
    nodeMap.set(n.id, {
      id: n.id, tag, label: n.label, path, status: 'done',
      defects: defectsMap[n.id] || { ux: 0, ui: 0, a11y: 0 },
      children: [],
    });
  }
  const childIds = new Set(edges.map(e => e.target));
  for (const e of edges) {
    const p = nodeMap.get(e.source), c = nodeMap.get(e.target);
    if (p && c) p.children!.push(c);
  }
  const roots = apiNodes.filter(n => !childIds.has(n.id)).map(n => nodeMap.get(n.id)!).filter(Boolean);
  if (roots.length === 1) return roots[0];
  return { id: 'root', tag: 'Entry', label: 'Site', path: '/', status: 'done', defects: { ux: 0, ui: 0, a11y: 0 }, children: roots };
}

function buildTreeFromCrawlResult(cr: BackendRun['crawlResult']): TreeNode {
  if (!cr || cr.nodes.length === 0) {
    return { id: 'empty', tag: 'Entry', label: 'No pages', path: '/', status: 'done', defects: { ux: 0, ui: 0, a11y: 0 }, children: [] };
  }
  const defectsMap: Record<string, { ux: number; ui: number; a11y: number }> = {};
  for (const f of cr.findings) {
    if (!defectsMap[f.nodeId]) defectsMap[f.nodeId] = { ux: 0, ui: 0, a11y: 0 };
    if (f.severity === 'high') defectsMap[f.nodeId].ux++;
    else if (f.severity === 'medium') defectsMap[f.nodeId].ui++;
    else defectsMap[f.nodeId].a11y++;
  }
  const nodeMap = new Map<string, TreeNode>();
  cr.nodes.forEach((n, i) => {
    let path = '/';
    try { path = new URL(n.url).pathname || '/'; } catch { /* keep '/' */ }
    nodeMap.set(n.id, {
      id: n.id, tag: i === 0 ? 'Entry' : 'Page',
      label: n.label, path, status: 'done',
      defects: defectsMap[n.id] || { ux: 0, ui: 0, a11y: 0 },
      children: [],
    });
  });
  const childIds = new Set(cr.edges.map(e => e.target));
  for (const e of cr.edges) {
    const p = nodeMap.get(e.source), c = nodeMap.get(e.target);
    if (p && c) p.children!.push(c);
  }
  const roots = cr.nodes.filter(n => !childIds.has(n.id)).map(n => nodeMap.get(n.id)!).filter(Boolean);
  if (roots.length === 1) return roots[0];
  return { id: 'root', tag: 'Entry', label: 'Site', path: '/', status: 'done', defects: { ux: 0, ui: 0, a11y: 0 }, children: roots };
}

function buildPartialTree(partialCrawl: BackendRun['partialCrawl']): TreeNode {
  if (!partialCrawl || partialCrawl.length === 0) {
    return { id: 'tmp', tag: 'Entry', label: 'Crawling…', path: '/', status: 'crawling', defects: { ux: 0, ui: 0, a11y: 0 }, children: [] };
  }
  const first = partialCrawl[0];
  let rootPath = '/';
  try { rootPath = new URL(first.url).pathname || '/'; } catch { /* keep '/' */ }
  return {
    id: first.id, tag: 'Entry', label: first.label, path: rootPath, status: 'done',
    defects: { ux: 0, ui: 0, a11y: 0 },
    children: partialCrawl.slice(1).map(p => {
      let path = '/';
      try { path = new URL(p.url).pathname || '/'; } catch { /* keep '/' */ }
      return { id: p.id, tag: 'Page', label: p.label, path, status: 'done', defects: { ux: 0, ui: 0, a11y: 0 }, children: [] };
    }),
  };
}

function convertRunToSite(run: BackendRun, target: UITarget): AgentSite {
  const state: AgentSite['state'] = run.state === 'done'
    ? (run.issuesFound > 10 ? 'red' : run.issuesFound > 0 ? 'amber' : 'green')
    : run.state === 'error' ? 'red' : 'amber';
  const tree = run.crawlResult ? buildTreeFromCrawlResult(run.crawlResult)
    : buildPartialTree(run.partialCrawl);
  let hostname = target.url;
  try { hostname = new URL(target.url.startsWith('http') ? target.url : 'https://' + target.url).hostname; } catch { /* keep raw */ }
  return {
    id: run.runId, name: target.name || hostname,
    url: target.url, env: target.env || 'production',
    state, pages: run.pagesFound || 0,
    findings: run.issuesFound || 0, tree,
  };
}

function fmtDur(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtNow(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* ─────────────────────────── ThemeSwitch ─────────────────────────────── */

function ThemeSwitch({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {
  return (
    <div className="theme-switch" role="tablist" aria-label="Theme">
      <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')} aria-label="Light"><IcSun w={13} h={13}/></button>
      <button className={theme === 'dark'  ? 'active' : ''} onClick={() => setTheme('dark')}  aria-label="Dark"><IcMoon w={13} h={13}/></button>
    </div>
  );
}

/* ─────────────────────────── Topbar ──────────────────────────────────── */

interface TopbarProps {
  theme: string; setTheme: (t: string) => void;
  url: string; setUrl: (u: string) => void;
  onAuditStart: () => void; isAuditing: boolean;
  onFolderMenu: () => void; onAgentToggle: () => void; agentOpen: boolean;
  auditError: string | null;
}

function Topbar({ theme, setTheme, url, setUrl, onAuditStart, isAuditing, onFolderMenu, onAgentToggle, agentOpen, auditError }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">UX</div>
        <div>
          <div className="brand-title">UX Auditor</div>
          <div className="brand-sub">Workspace · Primitive</div>
        </div>
      </div>

      <div className="topbar-mid">
        <span className="pill-web"><IcGlobe w={10} h={10} strokeWidth={2}/> Web</span>
        <label className={'url-bar' + (auditError ? ' url-bar-error' : '')}>
          <IcSearch w={13} h={13}/>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAuditStart()}
            placeholder="https://example.com   ·   press Enter to audit"
            spellCheck={false}
          />
          <span className="kbd">⌘ K</span>
        </label>
        <button className="btn btn-icon url-add-btn" onClick={onFolderMenu} title="Add audit source"><IcPlus w={13} h={13}/></button>
        {auditError && <span className="audit-error-chip" title={auditError}>⚠ Failed</span>}
        <button className="btn btn-icon" onClick={onFolderMenu} title="Audit a local flow"><IcFolder w={14} h={14}/></button>
        <div className="btn-split"><button>Recent <IcCaret w={12} h={12} className="caret"/></button></div>
      </div>

      <div className="topbar-right">
        <ThemeSwitch theme={theme} setTheme={setTheme}/>
        <button className={'btn ' + (agentOpen ? 'btn-on' : '')} onClick={onAgentToggle}>
          <IcAgent w={13} h={13}/> Agent
        </button>
        <div className="btn-split">
          <button><span className="dot dot-accent"/> Sonnet 4.6 · balanced <IcCaret w={12} h={12} className="caret"/></button>
        </div>
        <button className="btn"><IcExport w={13} h={13}/> Export</button>
        <button className={'btn ' + (isAuditing ? '' : 'btn-primary')} onClick={() => onAuditStart()} disabled={isAuditing}>
          {isAuditing
            ? <><span className="spinner"/> Crawling…</>
            : <><IcPlay w={11} h={11}/> Start audit</>}
        </button>
      </div>
    </header>
  );
}

/* ─────────────────────────── Sidebar ─────────────────────────────────── */

interface SidebarProps {
  activeId: string;
  setActiveId: (id: string) => void;
  crawlStats: { pages: number; depth: number; findings: number };
  historyItems: HistoryItem[];
  onRestoreSession: (id: string) => void;
}

function Sidebar({ activeId, setActiveId, crawlStats, historyItems, onRestoreSession }: SidebarProps) {
  const todayItems = historyItems.slice(0, 6);
  const earlierItems = historyItems.slice(6);

  return (
    <aside className="sidebar">
      <div className="side-block">
        <div className="side-label">Crawl</div>
        <div className="stats-grid">
          <div className="stat"><div className="stat-num">{crawlStats.pages}</div><div className="stat-lbl">Pages</div></div>
          <div className="stat"><div className="stat-num">{crawlStats.depth}</div><div className="stat-lbl">Depth</div></div>
          <div className="stat"><div className="stat-num">{crawlStats.findings}</div><div className="stat-lbl">Findings</div></div>
        </div>
      </div>

      <div className="side-block">
        <div className="side-label">Manual QA <button className="btn btn-sm">Author</button></div>
        <div className="side-hint">Add acceptance criteria the agent should verify on every audit.</div>
      </div>

      <div className="side-block">
        <div className="side-label">Visual baseline <button className="btn btn-sm">Set</button></div>
        <div className="side-hint">Compares future audits pixel-by-pixel against the saved frame.</div>
      </div>

      <div className="side-block">
        <div className="side-label">History</div>
        <div className="history-divider">Today</div>
        {todayItems.map(h => (
          <HistoryItemCard key={h.id} item={h} active={activeId === h.id}
            onClick={() => { setActiveId(h.id); onRestoreSession(h.id); }}/>
        ))}
        {earlierItems.length > 0 && (
          <>
            <div className="history-divider" style={{ marginTop: 14 }}>Earlier</div>
            {earlierItems.map(h => (
              <HistoryItemCard key={h.id} item={h} active={activeId === h.id}
                onClick={() => { setActiveId(h.id); onRestoreSession(h.id); }}/>
            ))}
          </>
        )}
      </div>

      <div className="side-block">
        <div className="side-label">Avatar</div>
        <div className="avatar-row">
          <div className="avatar-orb"/>
          <div>
            <div className="avatar-name">Nora</div>
            <div className="avatar-sub">silent · detail-bound</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function HistoryItemCard({ item, active, onClick }: { item: HistoryItem; active: boolean; onClick: () => void }) {
  return (
    <div className={'history-item ' + (active ? 'active' : '')} onClick={onClick}>
      <div className="history-row">
        <div className="history-url"><span className="scheme">url · </span>{item.url}</div>
        <div className="history-time">{item.time}</div>
      </div>
      <div className="history-meta">
        <div className="badges">
          {item.badges.map((b, i) => (
            <span key={i} className={'badge ' + b.sev}><span className="b-dot"/>{b.count}</span>
          ))}
        </div>
        <div className="history-dur">{item.dur}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Tree ────────────────────────────────────── */

interface TreeNodeProps {
  node: TreeNode;
  selectedId: string;
  onSelect: (id: string) => void;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  discoveredIds: Set<string> | null;
  statusOverrides: Record<string, string>;
  defectOverrides: Record<string, { ux: number; ui: number; a11y: number }>;
  screenshotMap: Record<string, string>;
  nodeOffset?: { x: number; y: number };
  onMoveNode?: (id: string, x: number, y: number) => void;
}

function TreeNodeCard({ node, selectedId, onSelect, collapsedIds, onToggle, discoveredIds, statusOverrides, defectOverrides, screenshotMap, nodeOffset, onMoveNode }: TreeNodeProps) {
  if (discoveredIds && !discoveredIds.has(node.id)) return null;

  const collapsed = collapsedIds.has(node.id);
  const status = statusOverrides[node.id] || node.status;
  const defects = defectOverrides[node.id] || node.defects;
  const visibleChildren = (node.children || []).filter(c => !discoveredIds || discoveredIds.has(c.id));
  const hasChildren = visibleChildren.length > 0;
  const totalDefects = defects.ux + defects.ui + defects.a11y;
  const sev = defects.ux + defects.a11y > 4 ? 'high' : totalDefects > 2 ? 'med' : totalDefects > 0 ? 'low' : 'none';
  const realShot = screenshotMap[node.id];

  /* drag-to-reposition */
  const dragRef = useRef<{ pid: number; mx: number; my: number; ox: number; oy: number } | null>(null);
  const didDragRef = useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !onMoveNode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    dragRef.current = { pid: e.pointerId, mx: e.clientX, my: e.clientY, ox: nodeOffset?.x ?? 0, oy: nodeOffset?.y ?? 0 };
    didDragRef.current = false;
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || e.pointerId !== dragRef.current.pid) return;
    const { mx, my, ox, oy } = dragRef.current;
    const dx = e.clientX - mx, dy = e.clientY - my;
    if (!didDragRef.current && Math.hypot(dx, dy) < 4) return;
    didDragRef.current = true;
    onMoveNode!(node.id, ox + dx, oy + dy);
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || e.pointerId !== dragRef.current.pid) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }
  function onCardClick(e: React.MouseEvent) {
    if (didDragRef.current) { didDragRef.current = false; return; }
    onSelect(node.id);
  }

  return (
    <div
      className="tree-node-wrap"
      style={nodeOffset ? { transform: `translate(${nodeOffset.x}px,${nodeOffset.y}px)`, position: 'relative', zIndex: 1 } : undefined}
    >
      <div
        className={'tree-card ' + (selectedId === node.id ? 'selected ' : '') + 'status-' + status}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onCardClick}
      >
        <div className="tree-card-top">
          <span className={'tag tag-' + node.tag.toLowerCase()}>{node.tag}</span>
          {status === 'crawling' && <span className="status-pill crawling"><span className="status-dot"/> Crawling</span>}
          {status === 'queued'   && <span className="status-pill queued"><span className="status-dot"/> Queued</span>}
          {status === 'blocked'  && <span className="status-pill blocked"><span className="status-dot"/> Blocked</span>}
          {status === 'done' && totalDefects === 0 && <span className="status-pill ok"><span className="status-dot"/> Clean</span>}
          {status === 'done' && totalDefects > 0 && (
            <span className={'status-pill sev-' + sev}><span className="status-dot"/>{totalDefects}</span>
          )}
        </div>

        <div className="tree-card-thumb">
          {(status === 'crawling' || status === 'queued')
            ? <div className="thumb-skeleton"><span className="scanline"/></div>
            : status === 'blocked'
              ? <div className="thumb-blocked"><IcLock w={20} h={20}/></div>
              : realShot
                ? <img src={realShot} alt={node.label} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
                : <NodeThumb/>}
        </div>

        <div className="tree-card-foot">
          <div className="tree-card-meta">
            <div className="tree-card-title">{node.label}</div>
            <div className="tree-card-path">{node.path}</div>
          </div>
          <div className="defect-row">
            <Pip kind="ux" n={defects.ux}/>
            <Pip kind="ui" n={defects.ui}/>
            <Pip kind="a11y" n={defects.a11y}/>
          </div>
        </div>
      </div>

      {hasChildren && (
        <button className="collapse-btn" onClick={e => { e.stopPropagation(); onToggle(node.id); }}>
          {collapsed ? <IcPlus w={11} h={11}/> : <IcMinus w={11} h={11}/>}
        </button>
      )}

      {hasChildren && !collapsed && (
        <div className="tree-children">
          {visibleChildren.map(c => (
            <TreeNodeCard key={c.id} node={c} selectedId={selectedId} onSelect={onSelect}
              collapsedIds={collapsedIds} onToggle={onToggle}
              discoveredIds={discoveredIds} statusOverrides={statusOverrides} defectOverrides={defectOverrides}
              screenshotMap={screenshotMap}
              onMoveNode={onMoveNode}/>
          ))}
        </div>
      )}
    </div>
  );
}

function Pip({ kind, n }: { kind: string; n: number }) {
  const labels: Record<string, string> = { ux: 'UX', ui: 'UI', a11y: 'A11Y' };
  return (
    <span className={'pip pip-' + kind + (n > 0 ? ' has' : '')}>
      <span className="pip-lbl">{labels[kind]}</span>
      <span className="pip-num">{n}</span>
    </span>
  );
}

/* ─────────────────────────── SiteSection ─────────────────────────────── */

interface SiteSectionProps {
  site: AgentSite;
  selectedNodeId: string;
  setSelectedNodeId: (id: string) => void;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  screenshotMap: Record<string, string>;
}

function SiteSection({ site, selectedNodeId, setSelectedNodeId, collapsedIds, onToggle, screenshotMap }: SiteSectionProps) {
  const total = countDefects(site.tree);
  return (
    <div className="site-section">
      <div className="site-header">
        <div className="site-header-row">
          <div className="site-state-dot" data-state={site.state}/>
          <div className="site-meta">
            <div className="site-name">{site.name}</div>
            <div className="site-url">{site.url}</div>
          </div>
          <div className="site-stats">
            <div className="site-stat">
              <div className="site-stat-num">{total.pages}</div>
              <div className="site-stat-lbl">Pages</div>
            </div>
            <div className="site-stat">
              <div className={'site-stat-num ' + (site.findings > 10 ? 'site-stat-warn' : '')}>{site.findings}</div>
              <div className="site-stat-lbl">Findings</div>
            </div>
          </div>
        </div>
        <div className="site-tags">
          <span className={'env-tag env-' + site.env}>{site.env}</span>
        </div>
      </div>
      <div className="site-tree">
        <TreeNodeCard
          node={site.tree}
          selectedId={selectedNodeId}
          onSelect={setSelectedNodeId}
          collapsedIds={collapsedIds}
          onToggle={onToggle}
          discoveredIds={null}
          statusOverrides={{}}
          defectOverrides={{}}
          screenshotMap={screenshotMap}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────── Canvas ──────────────────────────────────── */

interface CanvasProps {
  session: Session;
  selectedNodeId: string;
  setSelectedNodeId: (id: string) => void;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  isAuditing: boolean;
  runMode: 'single' | 'multi';
  setRunMode: (m: 'single' | 'multi') => void;
  crawlProgress: { current: string | null; done: number; total: number };
  discoveredIds: Set<string> | null;
  statusOverrides: Record<string, string>;
  defectOverrides: Record<string, { ux: number; ui: number; a11y: number }>;
  agentSites: AgentSite[];
  agentRunning: boolean;
  screenshotMap: Record<string, string>;
}

function Canvas({ session, selectedNodeId, setSelectedNodeId, collapsedIds, onToggle,
                  isAuditing, runMode, setRunMode, crawlProgress,
                  discoveredIds, statusOverrides, defectOverrides,
                  agentSites, agentRunning, screenshotMap }: CanvasProps) {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const panThresholdRef = useRef(false);

  const displaySites = agentSites.length > 0 ? agentSites : AGENT_RUN.sites;

  function moveNode(id: string, x: number, y: number) {
    setNodeOffsets(prev => ({ ...prev, [id]: { x, y } }));
  }

  /* wheel → zoom toward cursor (works with plain scroll and ctrl+scroll) */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom(z => {
        const newZ = Math.max(20, Math.min(300, z * factor));
        const ratio = newZ / z;
        setPan(p => ({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio }));
        return newZ;
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  /* pan: drag on background (not on tree cards) */
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('.tree-card') || t.closest('.collapse-btn') ||
        t.closest('.canvas-overlay-tr') || t.closest('.canvas-overlay-tl') ||
        t.closest('.nora-anchor') || t.closest('.statusbar') || t.closest('.site-card')) return;
    panStartRef.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    panThresholdRef.current = false;
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (!panStartRef.current) return;
    const { mx, my, px, py } = panStartRef.current;
    const dx = e.clientX - mx, dy = e.clientY - my;
    if (!panThresholdRef.current) {
      if (Math.hypot(dx, dy) < 4) return;
      panThresholdRef.current = true;
      setIsPanning(true);
    }
    setPan({ x: px + dx, y: py + dy });
  }

  function handleCanvasMouseUp() {
    panStartRef.current = null;
    panThresholdRef.current = false;
    setIsPanning(false);
  }

  return (
    <div
      className={'canvas' + (isPanning ? ' is-panning' : '')}
      ref={canvasRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
    >
      <div className="canvas-overlay-tr">
        <div className="zoom-pill">
          <button onClick={() => setZoom(z => Math.max(30, z - 10))} aria-label="Zoom out"><IcMinus w={12} h={12}/></button>
          <span className="zoom-val">{Math.round(zoom)}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} aria-label="Zoom in"><IcPlus w={12} h={12}/></button>
          <button onClick={() => { setZoom(100); setPan({ x: 0, y: 0 }); setNodeOffsets({}); }} aria-label="Fit"><IcMaximize w={12} h={12}/></button>
        </div>
      </div>

      <div className="canvas-overlay-tl">
        <div className="legend-pill">
          <span className="legend-lbl">Defects</span>
          <span className="legend-item"><span className="legend-dot ux"/>UX</span>
          <span className="legend-item"><span className="legend-dot ui"/>UI</span>
          <span className="legend-item"><span className="legend-dot a11y"/>A11Y</span>
        </div>
        {runMode === 'multi' && (
          <button className="btn btn-sm exit-multi" onClick={() => setRunMode('single')}>
            <IcClose w={11} h={11}/> Exit agent run
          </button>
        )}
        {runMode === 'single' && (
          <div className="session-pill">
            <span className="session-dot"/>
            <span className="session-host">{session.host}</span>
            <span className="session-id">· {session.sessionId}</span>
          </div>
        )}
      </div>

      <div className="canvas-inner" style={runMode === 'multi' ? { padding: '64px 40px 80px' } : undefined}>
        {runMode === 'multi' && (
          <div className="run-banner-inline">
            <div className="run-banner-meta">
              <span className="run-pill">
                <span className={'run-pill-dot' + (agentRunning ? ' go' : '')}/>
                {agentRunning ? 'Running…' : 'Agent run complete'}
              </span>
              <span className="run-meta-sep">·</span>
              <span>{displaySites.length} site{displaySites.length === 1 ? '' : 's'}</span>
            </div>
            <div className="run-banner-actions">
              <button className="btn btn-sm">Compare to last run</button>
              <button className="btn btn-sm btn-primary"><IcPlay w={10} h={10}/> Re-run</button>
            </div>
          </div>
        )}
        <div
          className={runMode === 'multi' ? 'multi-stage' : 'tree-root'}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
            transformOrigin: runMode === 'multi' ? 'top left' : 'top center',
          }}
        >
          {runMode === 'single'
            ? <TreeNodeCard
                node={session.tree}
                selectedId={selectedNodeId}
                onSelect={setSelectedNodeId}
                collapsedIds={collapsedIds}
                onToggle={onToggle}
                discoveredIds={discoveredIds}
                statusOverrides={statusOverrides}
                defectOverrides={defectOverrides}
                screenshotMap={screenshotMap}
                nodeOffset={nodeOffsets[session.tree.id]}
                onMoveNode={moveNode}
              />
            : displaySites.map(site => (
                <SiteSection
                  key={site.id}
                  site={site}
                  selectedNodeId={selectedNodeId}
                  setSelectedNodeId={setSelectedNodeId}
                  collapsedIds={collapsedIds}
                  onToggle={onToggle}
                  screenshotMap={screenshotMap}
                />
              ))}
        </div>
      </div>

      <div className="nora-anchor">
        <div className="nora-bubble">
          {isAuditing
            ? <>Crawling <b>{session.host}{crawlProgress.current}</b>… {crawlProgress.done}/{crawlProgress.total || '?'}</>
            : agentRunning
              ? <>Agent running <b>{displaySites.length} site{displaySites.length === 1 ? '' : 's'}</b>…</>
              : runMode === 'multi'
                ? <>Agent run complete · <b>{displaySites.length} site{displaySites.length === 1 ? '' : 's'}</b> audited.</>
                : <>Audit complete on <b>{session.host}</b>. Click a node for details.</>}
        </div>
        <div className="nora-fig"/>
      </div>

      <div className="statusbar">
        <span className={'live-dot ' + (isAuditing || agentRunning ? 'go' : '')}/>
        <span>{isAuditing || agentRunning ? 'Crawling' : 'Idle'}</span>
        <span className="sep"/>
        <span>{runMode === 'multi' ? `${displaySites.length} sites` : session.host}</span>
        {isAuditing && (<><span className="sep"/><span>{crawlProgress.done}/{crawlProgress.total} pages</span></>)}
        <span className="sep"/>
        <span>Sonnet 4.6</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── PreviewCard ─────────────────────────────── */

function PreviewCard({ node, host, screenshotMap, wireframeMap, videoMap, nodeFindings, nodeAnnotations, onAnnotate }: {
  node: TreeNode; host: string;
  screenshotMap: Record<string, string>;
  wireframeMap: Record<string, string>;
  videoMap: Record<string, string>;
  nodeFindings: RealFinding[];
  nodeAnnotations: ManualAnnotation[];
  onAnnotate: (mode: 'screenshot' | 'wireframe') => void;
}) {
  const [view, setView] = useState<'screenshot' | 'wireframe' | 'video'>('screenshot');
  const url = 'https://' + host + (node.path === '/' ? '' : node.path);
  const realShot = screenshotMap[node.id];
  const realWire = wireframeMap[node.id];
  const realVideo = videoMap[node.id];

  void nodeFindings; // findings shown in the list below, not as hotspots

  return (
    <div className="preview">
      <div className="preview-bar">
        <div className="pb-traffic">
          <span className="pb-dot"/><span className="pb-dot"/><span className="pb-dot"/>
        </div>
        <span className="pb-url">{url}</span>
        <span className="pb-meta">1440 × 900</span>
      </div>
      <div className="preview-toolbar">
        <div className="seg preview-seg">
          <button className={'seg-btn ' + (view === 'screenshot' ? 'on' : '')} onClick={() => setView('screenshot')}>
            <IcCamera w={11} h={11}/> Screenshot
          </button>
          <button className={'seg-btn ' + (view === 'wireframe' ? 'on' : '')} onClick={() => setView('wireframe')}>
            <IcLayers w={11} h={11}/> Wireframe
          </button>
          {realVideo && (
            <button className={'seg-btn ' + (view === 'video' ? 'on' : '')} onClick={() => setView('video')}>
              <IcPlay w={11} h={11}/> Video
            </button>
          )}
        </div>
        <button
          className={'chip-btn' + (nodeAnnotations.length > 0 ? ' on' : '')}
          onClick={() => onAnnotate(view === 'video' ? 'screenshot' : view)}
          title="Draw annotations on this screen">
          <IcTarget w={11} h={11}/>
          {nodeAnnotations.length > 0 ? `${nodeAnnotations.length} annotation${nodeAnnotations.length > 1 ? 's' : ''}` : 'Annotate'}
        </button>
      </div>
      <div className={'preview-img ' + (view === 'screenshot' ? 'is-screenshot ' : '')}>
        {view === 'video'
          ? realVideo
            ? <video
                key={node.id}
                src={realVideo}
                controls
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
              />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fg-faint)', fontSize: 11 }}>
                No recording available
              </div>
          : view === 'wireframe'
            ? realWire
              ? <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: realWire }}/>
              : realShot
                ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--fg-faint)' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'spin 1.2s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    <span style={{ fontSize: 11 }}>Generating wireframe…</span>
                  </div>
                : getWireframeForNode(node)
            : realShot
              ? <img src={realShot} alt={node.label} style={{ display: 'block', width: '100%' }}/>
              : getScreenshotForNode(node)}
        {/* Read-only annotation overlay */}
        {nodeAnnotations.length > 0 && (
          <svg className="ann-preview-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {nodeAnnotations.map(ann => {
              const shared = { fill: 'none', stroke: ann.color, strokeWidth: 0.5, strokeDasharray: '2 1' };
              if (ann.shape === 'rect') {
                return (
                  <g key={ann.id}>
                    <rect x={ann.x} y={ann.y} width={ann.w} height={ann.h} rx={0.4} {...shared}/>
                    {ann.label && (
                      <text x={ann.x + 0.5} y={ann.y + 3.8} fill={ann.color} fontSize={2.6}
                        fontFamily="ui-monospace,monospace" fontWeight="700"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {ann.label}
                      </text>
                    )}
                  </g>
                );
              }
              const cx = ann.x + ann.w / 2, cy = ann.y + ann.h / 2;
              return (
                <g key={ann.id}>
                  <ellipse cx={cx} cy={cy} rx={ann.w / 2} ry={ann.h / 2} {...shared}/>
                  {ann.label && (
                    <text x={cx} y={ann.y - 0.5} fill={ann.color} fontSize={2.6}
                      fontFamily="ui-monospace,monospace" fontWeight="700" textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {ann.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        <div className="preview-overlay">
          <span className="ovl-chip">
            <span className="live-dot go"/>
            {realShot ? 'captured by crawler · full page' : 'captured 12 min ago · full page · 3.2 MB'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── RightPanel ──────────────────────────────── */

interface RightPanelProps {
  onClose: () => void;
  selectedNode: TreeNode;
  session: Session;
  hostOverride?: string;
  screenshotMap: Record<string, string>;
  wireframeMap: Record<string, string>;
  videoMap: Record<string, string>;
  realFindings: RealFinding[];
  elementMap: Record<string, ClickableElement[]>;
  annotationsMap: Record<string, ManualAnnotation[]>;
  onAnnotate: (nodeId: string, nodeLabel: string, mode: 'screenshot' | 'wireframe') => void;
}

function RightPanel({ onClose, selectedNode, session, hostOverride, screenshotMap, wireframeMap, videoMap, realFindings, elementMap, annotationsMap, onAnnotate }: RightPanelProps) {
  const node = selectedNode;
  const host = hostOverride ?? session.host;
  const [tab, setTab] = useState<'findings' | 'tests' | 'scripts' | 'timeline'>('findings');
  const [catFilter, setCatFilter] = useState('all');

  // Use real findings if available for this node, else fall back to mock
  const nodeRealFindings = realFindings.filter(f => f.nodeId === node.id);
  void (elementMap[node.id]); // elements retained for future use
  const hasRealFindings = realFindings.length > 0;

  const allFindings = hasRealFindings
    ? nodeRealFindings.map((f, i) => ({
        id: `rf${i}`,
        sev: (f.severity === 'medium' ? 'med' : f.severity) as 'high' | 'med' | 'low',
        msg: f.message,
        selector: f.rule,
        cat: (f.severity === 'high' ? 'a11y' : f.severity === 'medium' ? 'ui' : 'ux') as 'ux' | 'ui' | 'a11y',
        time: undefined,
        count: undefined,
      }))
    : [
        ...FINDINGS.ux.map(f => ({ ...f, cat: 'ux' as const })),
        ...FINDINGS.ui.map(f => ({ ...f, cat: 'ui' as const })),
        ...FINDINGS.a11y.map(f => ({ ...f, cat: 'a11y' as const })),
      ];

  const visible = catFilter === 'all' ? allFindings : allFindings.filter(f => f.cat === catFilter);
  const totals = {
    high: allFindings.filter(f => f.sev === 'high').length,
    med:  allFindings.filter(f => f.sev === 'med').length,
    low:  allFindings.filter(f => f.sev === 'low').length,
  };

  return (
    <aside className="rightpanel">
      <div className="rp-head">
        <button className="rp-close" onClick={onClose} aria-label="Close"><IcClose w={14} h={14}/></button>
        <div className="rp-kicker">
          <span className={'tag tag-' + node.tag.toLowerCase()}>{node.tag}</span>
          <span className="rp-path">{node.path}</span>
        </div>
        <div className="rp-title">{node.label}</div>
        <div className="rp-url">https://{host}{node.path === '/' ? '' : node.path}</div>
      </div>

      <div className="tabs">
        <button className={'tab ' + (tab === 'findings' ? 'active' : '')} onClick={() => setTab('findings')}>
          Findings <span className="tab-count">{allFindings.length}</span>
        </button>
        <button className={'tab ' + (tab === 'tests' ? 'active' : '')} onClick={() => setTab('tests')}>
          Test cases <span className="tab-count">2</span>
        </button>
        <button className={'tab ' + (tab === 'scripts' ? 'active' : '')} onClick={() => setTab('scripts')}>
          Scripts <span className="tab-count">0</span>
        </button>
        <button className={'tab ' + (tab === 'timeline' ? 'active' : '')} onClick={() => setTab('timeline')}>
          Timeline
        </button>
      </div>

      <div className="rp-body">
        {tab === 'findings' && (
          <>
            <PreviewCard node={node} host={host} screenshotMap={screenshotMap} wireframeMap={wireframeMap} videoMap={videoMap} nodeFindings={nodeRealFindings} nodeAnnotations={annotationsMap[node.id] ?? []} onAnnotate={mode => onAnnotate(node.id, node.label, mode)}/>

            <div className="sev-grid">
              <div className="sev-card sev-high"><div className="sev-label">High</div><div className="sev-num">{totals.high}</div></div>
              <div className="sev-card sev-med"><div className="sev-label">Medium</div><div className="sev-num">{totals.med}</div></div>
              <div className="sev-card sev-low"><div className="sev-label">Low</div><div className="sev-num">{totals.low}</div></div>
            </div>

            <div className="cat-filter">
              {[
                { k: 'all',  l: 'All',           n: allFindings.length },
                { k: 'ux',   l: 'UX',            n: allFindings.filter(f => f.cat === 'ux').length },
                { k: 'ui',   l: 'UI',            n: allFindings.filter(f => f.cat === 'ui').length },
                { k: 'a11y', l: 'Accessibility', n: allFindings.filter(f => f.cat === 'a11y').length },
              ].map(c => (
                <button key={c.k}
                  className={'cat-chip ' + (catFilter === c.k ? 'on' : '')}
                  onClick={() => setCatFilter(c.k)}>
                  {c.l} <span className="cat-num">{c.n}</span>
                </button>
              ))}
            </div>

            <div className="findings-list">
              {visible.map(f => (
                <div key={f.id} className="finding">
                  <div className="finding-row">
                    <div className="finding-left">
                      <span className={'badge ' + f.sev}><span className="b-dot"/>{f.sev}</span>
                      <span className={'cat-tag cat-' + f.cat}>{f.cat}</span>
                      {f.time && <span className="finding-time">{f.time}</span>}
                    </div>
                    <div className="finding-actions">
                      <button className="ico-btn" title="Add test case"><IcPlus w={12} h={12}/></button>
                      <button className="finding-explain"><IcSpark w={10} h={10}/> Explain</button>
                    </div>
                  </div>
                  {/* eslint-disable-next-line react/no-danger */}
                  <div className="finding-msg" dangerouslySetInnerHTML={{ __html: f.msg }}/>
                  {f.selector && (
                    <div className="finding-foot">
                      <code className="selector">{f.selector}</code>
                      {f.count != null && <span className="count">{f.count} element{f.count > 1 ? 's' : ''}</span>}
                    </div>
                  )}
                </div>
              ))}
              {visible.length === 0 && (
                <div className="empty">
                  <div className="empty-title">No findings</div>
                  <div className="empty-body">This page looks clean for the selected category.</div>
                </div>
              )}
            </div>
          </>
        )}
        {tab === 'tests' && <TestCasesView/>}
        {tab === 'scripts' && (
          <EmptyState title="No scripts yet" body="Drop Playwright or custom scripts the agent should run on every audit pass." cta="Add script"/>
        )}
        {tab === 'timeline' && <TimelineView/>}
      </div>
    </aside>
  );
}

function TestCasesView() {
  const cases = [
    { id: 'tc1', title: 'New user can clone a voice in under 3 minutes', steps: 4, passes: 8, fails: 1, status: 'passing' },
    { id: 'tc2', title: 'Pricing CTA is reachable from every marketing page', steps: 2, passes: 12, fails: 0, status: 'passing' },
  ];
  return (
    <>
      <div className="findings-head">
        <div className="findings-title">Acceptance criteria · 2</div>
        <button className="btn btn-sm btn-primary"><IcPlus w={11} h={11}/> Author</button>
      </div>
      {cases.map(c => (
        <div key={c.id} className="testcase">
          <div className="testcase-row">
            <span className={'status-pill ' + (c.status === 'passing' ? 'ok' : 'sev-high')}>
              <span className="status-dot"/>{c.status}
            </span>
            <span className="testcase-stats">{c.passes} pass · {c.fails} fail · {c.steps} steps</span>
          </div>
          <div className="testcase-title">{c.title}</div>
        </div>
      ))}
    </>
  );
}

function TimelineView() {
  const events = [
    { t: '01:38:44', kind: 'finding', sev: 'low',  msg: 'Heading order on /voice' },
    { t: '01:38:33', kind: 'finding', sev: 'med',  msg: 'ARIA allowed attr · 1 element' },
    { t: '01:38:25', kind: 'finding', sev: 'high', msg: 'Color contrast on 12 nodes' },
    { t: '01:38:09', kind: 'crawl',                msg: 'Captured /voice/clone' },
    { t: '01:37:56', kind: 'crawl',                msg: 'Captured /pricing/enterprise' },
    { t: '01:36:54', kind: 'start',                msg: 'Audit started · depth 3 · sonnet-4.6' },
  ];
  return (
    <div className="timeline">
      {events.map((e, i) => (
        <div key={i} className="tl-row">
          <span className="tl-time">{e.t}</span>
          {e.kind === 'finding'
            ? <span className={'badge ' + (e.sev || 'low')}><span className="b-dot"/>{e.sev}</span>
            : e.kind === 'start'
              ? <span className="tl-marker tl-start"><IcPlay w={9} h={9}/></span>
              : <span className="tl-marker tl-crawl"><IcGlobe w={9} h={9}/></span>}
          <span className="tl-msg">{e.msg}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta: string }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      <div className="empty-body">{body}</div>
      <button className="btn btn-sm btn-primary">{cta}</button>
    </div>
  );
}

/* ─────────────────────────── FolderMenu ──────────────────────────────── */

interface FolderMenuProps {
  onClose: () => void;
  onStartWebAudit: (url: string) => void;
}

function FolderMenu({ onClose, onStartWebAudit }: FolderMenuProps) {
  const [active, setActive] = useState<string | null>(null);
  const [webUrl, setWebUrl] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [iosInput, setIosInput] = useState('');
  const [androidInput, setAndroidInput] = useState('');
  const macosRef = useRef<HTMLInputElement>(null);
  const windowsRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const SOURCES = [
    { id: 'web',     icon: <IcGlobe w={18} h={18}/>,  name: 'Web URL',  sub: 'Audit any public website by URL' },
    { id: 'macos',   icon: <IcCamera w={18} h={18}/>, name: 'macOS',    sub: 'Select a .app bundle from Finder' },
    { id: 'windows', icon: <IcLayers w={18} h={18}/>, name: 'Windows',  sub: 'Pick an .exe via file picker' },
    { id: 'ios',     icon: <IcAgent w={18} h={18}/>,  name: 'iOS',      sub: 'Mirror device via Xcode bridge' },
    { id: 'android', icon: <IcTarget w={18} h={18}/>, name: 'Android',  sub: 'ADB bridge — emulator or physical device' },
    { id: 'figma',   icon: <IcSpark w={18} h={18}/>,  name: 'Figma',    sub: 'Audit prototypes from a Figma file URL' },
    { id: 'folder',  icon: <IcFolder w={18} h={18}/>, name: 'Folder',   sub: 'Local directory of screenshots or HTML' },
  ];

  const src = SOURCES.find(s => s.id === active);

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>, label: string) {
    const name = e.target.files?.[0]?.name || e.target.files?.[0]?.webkitRelativePath || 'selected';
    alert(`${label} selected: ${name}\n(backend integration coming soon)`);
    onClose();
  }

  function renderForm() {
    switch (active) {
      case 'web':
        return (
          <div className="fm-form">
            <label className="fm-label">Website URL</label>
            <input
              className="fm-input" autoFocus
              placeholder="https://example.com"
              value={webUrl} onChange={e => setWebUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && webUrl.trim()) { onStartWebAudit(webUrl.trim()); onClose(); } }}
            />
            <p className="fm-hint">Enter any public URL — press Enter or click Start Audit.</p>
            <button
              className="btn btn-primary fm-submit"
              disabled={!webUrl.trim()}
              onClick={() => { onStartWebAudit(webUrl.trim()); onClose(); }}
            >
              <IcPlay w={11} h={11}/> Start audit
            </button>
          </div>
        );
      case 'macos':
        return (
          <div className="fm-form">
            <label className="fm-label">macOS app bundle</label>
            <input ref={macosRef} type="file" accept=".app" style={{ display: 'none' }} onChange={e => handleFileChosen(e, 'App')}/>
            <p className="fm-hint">Opens Finder — navigate to <code>/Applications</code> and select any <code>.app</code> bundle.</p>
            <button className="btn btn-primary fm-submit" onClick={() => macosRef.current?.click()}>
              <IcFolder w={13} h={13}/> Browse in Finder…
            </button>
          </div>
        );
      case 'windows':
        return (
          <div className="fm-form">
            <label className="fm-label">Windows executable</label>
            <input ref={windowsRef} type="file" accept=".exe,.msi" style={{ display: 'none' }} onChange={e => handleFileChosen(e, 'Executable')}/>
            <p className="fm-hint">Opens the file picker — select an <code>.exe</code> or <code>.msi</code> to audit.</p>
            <button className="btn btn-primary fm-submit" onClick={() => windowsRef.current?.click()}>
              <IcFolder w={13} h={13}/> Browse…
            </button>
          </div>
        );
      case 'ios':
        return (
          <div className="fm-form">
            <label className="fm-label">Device IP or bundle ID</label>
            <input
              className="fm-input" autoFocus
              placeholder="192.168.1.x  or  com.company.app"
              value={iosInput} onChange={e => setIosInput(e.target.value)}
            />
            <p className="fm-hint">Connect your iPhone/iPad over the same Wi-Fi network and enter its IP, or paste the app bundle ID for Xcode simulator capture.</p>
            <button className="btn btn-primary fm-submit" disabled={!iosInput.trim()} onClick={onClose}>
              <IcPlay w={11} h={11}/> Connect device
            </button>
          </div>
        );
      case 'android':
        return (
          <div className="fm-form">
            <label className="fm-label">ADB device serial or package name</label>
            <input
              className="fm-input" autoFocus
              placeholder="emulator-5554  or  com.company.app"
              value={androidInput} onChange={e => setAndroidInput(e.target.value)}
            />
            <p className="fm-hint">Run <code>adb devices</code> to find the serial. For physical devices, enable USB debugging first.</p>
            <button className="btn btn-primary fm-submit" disabled={!androidInput.trim()} onClick={onClose}>
              <IcPlay w={11} h={11}/> Connect device
            </button>
          </div>
        );
      case 'figma':
        return (
          <div className="fm-form">
            <label className="fm-label">Figma file URL</label>
            <input
              className="fm-input" autoFocus
              placeholder="https://www.figma.com/file/…"
              value={figmaUrl} onChange={e => setFigmaUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && figmaUrl.trim() && onClose()}
            />
            <p className="fm-hint">Paste a Figma file or prototype link. Requires Figma OAuth in settings.</p>
            <button className="btn btn-primary fm-submit" disabled={!figmaUrl.trim()} onClick={onClose}>
              <IcPlay w={11} h={11}/> Audit prototype
            </button>
          </div>
        );
      case 'folder':
        return (
          <div className="fm-form">
            <label className="fm-label">Local folder</label>
            {/* webkitdirectory opens a folder picker on macOS/Windows */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <input ref={folderRef} type="file" {...({ webkitdirectory: '' } as any)} style={{ display: 'none' }} onChange={e => handleFileChosen(e, 'Folder')}/>
            <p className="fm-hint">Select a local folder containing screenshots, HTML files, or a Flutter project for static analysis.</p>
            <button className="btn btn-primary fm-submit" onClick={() => folderRef.current?.click()}>
              <IcFolder w={13} h={13}/> Choose folder…
            </button>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="fm-backdrop" onClick={onClose}>
      <div className="fm-panel" onClick={e => e.stopPropagation()}>
        <div className="fm-head">
          <div>
            {active
              ? <button className="fm-back-btn" onClick={() => setActive(null)}>
                  <IcChevronRight w={12} h={12} style={{ transform: 'rotate(180deg)' }}/> Back
                </button>
              : <div className="fm-kicker">Audit a flow</div>}
            <div className="fm-title" style={{ marginTop: active ? 4 : 2 }}>
              {src ? src.name : 'Pick a source'}
            </div>
            {src && <div className="fm-kicker" style={{ marginTop: 3, textTransform: 'none', letterSpacing: 0 }}>{src.sub}</div>}
          </div>
          <button className="rp-close" onClick={onClose}><IcClose w={14} h={14}/></button>
        </div>

        {active
          ? renderForm()
          : (
            <div className="fm-grid">
              {SOURCES.map(s => (
                <button key={s.id} className="fm-card" onClick={() => setActive(s.id)}>
                  <div className="fm-icon">{s.icon}</div>
                  <div className="fm-card-meta">
                    <div className="fm-card-title">{s.name}</div>
                    <div className="fm-card-sub">{s.sub}</div>
                  </div>
                  <IcChevronRight w={14} h={14} strokeWidth={1.5}/>
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

/* ─────────────────────────── AgentPanel ──────────────────────────────── */

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={'toggle ' + (on ? 'on' : '')} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="toggle-knob"/>
    </button>
  );
}

interface AgentPanelProps {
  onClose: () => void;
  onRunNow: (targets: UITarget[]) => void;
  isRunning: boolean;
  targets: UITarget[];
  setTargets: (fn: (prev: UITarget[]) => UITarget[]) => void;
}

function AgentPanel({ onClose, onRunNow, isRunning, targets, setTargets }: AgentPanelProps) {
  const [schedule, setSchedule] = useState('daily');
  const [visualDiff, setVisualDiff] = useState(5);
  const [minSev, setMinSev] = useState('med');
  const [github, setGithub] = useState(false);
  const [slack, setSlack] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');

  const addTarget = () => {
    if (!newUrl.trim()) return;
    const rawUrl = newUrl.trim();
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
    setTargets(t => [...t, {
      id: 't' + Date.now(), url: fullUrl,
      name: newName.trim() || rawUrl, env: 'production', state: 'green',
    }]);
    setNewUrl(''); setNewName('');
  };
  const removeTarget = (id: string) => setTargets(t => t.filter(x => x.id !== id));

  return (
    <aside className="agent-panel">
      <div className="rp-head">
        <button className="rp-close" onClick={onClose}><IcClose w={14} h={14}/></button>
        <div className="rp-kicker">Autonomous agent</div>
        <div className="rp-title">Background sweep</div>
        <div className="rp-url">Runs unattended · files findings · pings on regression</div>
      </div>
      <div className="ap-body">
        <div className="ap-section">
          <div className="ap-label">Status</div>
          <div className="ap-status-card">
            <div className="ap-status-row">
              <span className={'live-dot ' + (isRunning ? 'go' : '')}/>
              <span><b>{isRunning ? 'Running…' : 'Idle'}</b>{!isRunning && ' · next run in 4h 12m'}</span>
            </div>
            <div className="ap-status-sub">{targets.length} target{targets.length === 1 ? '' : 's'} configured</div>
          </div>
        </div>
        <div className="ap-section">
          <div className="ap-label">Watch targets <span className="ap-label-count">{targets.length}</span></div>
          {targets.map(t => (
            <div key={t.id} className="target-card">
              <div className={'target-state ' + t.state}/>
              <div className="target-meta">
                <div className="target-name">{t.name}</div>
                <div className="target-url">{t.url}</div>
              </div>
              <span className={'env-tag env-' + t.env}>{t.env}</span>
              <button className="target-remove" onClick={() => removeTarget(t.id)}><IcClose w={11} h={11}/></button>
            </div>
          ))}
          <div className="ap-input-row">
            <input className="ap-input" placeholder="https://example.com" value={newUrl}
              onChange={e => setNewUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTarget()}/>
            <input className="ap-input ap-input-name" placeholder="Name" value={newName}
              onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTarget()}/>
            <button className="btn btn-sm btn-primary" onClick={addTarget}>Add</button>
          </div>
        </div>
        <div className="ap-section">
          <div className="ap-label">Schedule</div>
          <div className="seg">
            {['off', 'hourly', 'daily', 'weekly'].map(s => (
              <button key={s} className={'seg-btn ' + (schedule === s ? 'on' : '')} onClick={() => setSchedule(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="ap-section">
          <div className="ap-label">Thresholds</div>
          <div className="ap-row">
            <div className="ap-row-head"><span>Visual diff</span><span className="ap-row-val">{visualDiff}%</span></div>
            <input type="range" className="ap-range" min="0" max="20" value={visualDiff} onChange={e => setVisualDiff(+e.target.value)}/>
          </div>
          <div className="ap-row">
            <div className="ap-row-head"><span>File issue at</span></div>
            <div className="seg">
              {[{ k: 'low', l: 'Low' }, { k: 'med', l: 'Medium' }, { k: 'high', l: 'High' }].map(s => (
                <button key={s.k} className={'seg-btn ' + (minSev === s.k ? 'on' : '')} onClick={() => setMinSev(s.k)}>{s.l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="ap-section">
          <div className="ap-label">Notify</div>
          <div className="notify-row">
            <div><div className="notify-title">GitHub issues</div><div className="notify-sub">Files to primitive/ux-auditor</div></div>
            <Toggle on={github} onChange={setGithub}/>
          </div>
          <div className="notify-row">
            <div><div className="notify-title">Slack</div><div className="notify-sub">#design-qa</div></div>
            <Toggle on={slack} onChange={setSlack}/>
          </div>
        </div>
        <button
          className="btn btn-primary ap-run"
          onClick={() => onRunNow(targets)}
          disabled={targets.length === 0 || isRunning}>
          {isRunning
            ? <><span className="spinner"/> Running {targets.length} site{targets.length === 1 ? '' : 's'}…</>
            : <><IcPlay w={11} h={11}/> Run now · {targets.length} site{targets.length === 1 ? '' : 's'}</>}
        </button>
      </div>
    </aside>
  );
}

/* ─────────────────────────── App ─────────────────────────────────────── */

interface Session {
  host: string; label: string; sessionId: string; tree: TreeNode;
}

export default function Page() {
  const [theme, setTheme] = useState('dark');
  const [url, setUrl] = useState('https://elevenlabs.io/');
  const [activeHistory, setActiveHistory] = useState('h1');
  const [showPanel, setShowPanel] = useState(true);
  const [isAuditing, setIsAuditing] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [folderOpen, setFolderOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [runMode, setRunMode] = useState<'single' | 'multi'>('single');

  // Real data state
  const [screenshotMap, setScreenshotMap] = useState<Record<string, string>>({});
  const [wireframeMap, setWireframeMap] = useState<Record<string, string>>({});
  const [videoMap, setVideoMap] = useState<Record<string, string>>({});
  const [realFindings, setRealFindings] = useState<RealFinding[]>([]);
  const [elementMap, setElementMap] = useState<Record<string, ClickableElement[]>>({});
  const [annotationsMap, setAnnotationsMap] = useState<Record<string, ManualAnnotation[]>>({});
  const [annotatingNode, setAnnotatingNode] = useState<{ nodeId: string; mode: 'screenshot' | 'wireframe'; nodeLabel: string } | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([...HISTORY]);
  const [agentSites, setAgentSites] = useState<AgentSite[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Lifted agent targets — start empty so only user-added sites run
  const [agentTargets, setAgentTargets] = useState<UITarget[]>([]);

  // Session store: historyId → full session data (for restoration)
  const sessionStoreRef = useRef<Map<string, StoredSession>>(new Map());
  // Becomes true after IDB is loaded so the persist effect doesn't save mock data
  const idbLoadedRef = useRef(false);

  const initial = useMemo<Session>(() => ({
    host: 'elevenlabs.io', label: 'ElevenLabs', sessionId: 's0', tree: SITE_TREE,
  }), []);
  const [session, setSession] = useState<Session>(initial);

  const [discoveredIds, setDiscoveredIds] = useState<Set<string> | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [defectOverrides, setDefectOverrides] = useState<Record<string, { ux: number; ui: number; a11y: number }>>({});
  const [crawlProgress, setCrawlProgress] = useState<{ current: string | null; done: number; total: number }>({ current: null, done: 0, total: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState(SITE_TREE.id);
  const auditAbortRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // Load persisted history + sessions from IndexedDB on mount
  useEffect(() => {
    (async () => {
      const [savedItems, allSessions] = await Promise.all([
        dbGet<HistoryItem[]>('audit-history', 'history-items'),
        dbGetAll<StoredSession>('canvas-session'),
      ]);
      if (savedItems && savedItems.length > 0) setHistoryItems(savedItems);
      for (const { key, value } of allSessions) {
        sessionStoreRef.current.set(key, value);
      }
      idbLoadedRef.current = true;
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist historyItems to IDB whenever they change (skip initial mock-data render)
  useEffect(() => {
    if (!idbLoadedRef.current) return;
    dbSet('audit-history', 'history-items', historyItems).catch(console.error);
  }, [historyItems]);

  const onToggleCollapse = (id: string) => {
    setCollapsedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  /* ─── Add to history helpers ──────────────────────────────────────── */

  const addToHistory = useCallback((
    itemUrl: string,
    newSession: Session,
    durationMs: number,
    findings: RealFinding[],
    shots: Record<string, string>,
    elMap: Record<string, ClickableElement[]> = {},
    vids: Record<string, string> = {}
  ) => {
    const high = findings.filter(f => f.severity === 'high').length;
    const med  = findings.filter(f => f.severity === 'medium').length;
    const low  = findings.filter(f => f.severity === 'low').length;
    const badges: HistoryItem['badges'] = [];
    if (high > 0) badges.push({ sev: 'high', count: high });
    if (med  > 0) badges.push({ sev: 'med',  count: med  });
    if (low  > 0) badges.push({ sev: 'low',  count: low  });

    const id = 'live-' + Date.now();
    const item: HistoryItem = {
      id,
      url: itemUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0],
      time: fmtNow(),
      dur: fmtDur(durationMs),
      badges,
    };

    const storedSession: StoredSession = {
      session: newSession,
      screenshotMap: shots,
      wireframeMap: {},
      videoMap: vids,
      realFindings: findings,
      elementMap: elMap,
      annotationsMap: {},
    };
    sessionStoreRef.current.set(id, storedSession);

    // Persist session to IDB immediately
    dbSet('canvas-session', id, storedSession).catch(() => {});

    setHistoryItems(prev => [item, ...prev].slice(0, 20));
    setActiveHistory(id);
    return id;
  }, []);

  const saveAnnotations = useCallback((nodeId: string, annotations: ManualAnnotation[]) => {
    setAnnotationsMap(prev => {
      const next = { ...prev, [nodeId]: annotations };
      const stored = sessionStoreRef.current.get(activeHistory);
      if (stored) {
        const updated = { ...stored, annotationsMap: next };
        sessionStoreRef.current.set(activeHistory, updated);
        dbSet('canvas-session', activeHistory, updated).catch(() => {});
      }
      return next;
    });
  }, [activeHistory]);

  /* ─── Wireframe generation (parallel, progressive) ────────────────── */

  const generateWireframes = useCallback((shots: Record<string, string>, historyId?: string) => {
    setWireframeMap({});
    const entries = Object.entries(shots);
    for (const [nodeId, screenshot] of entries) {
      fetch('/api/wireframe/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenshot, nodeId }),
      })
        .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
        .then(({ svg }: { svg: string }) => {
          setWireframeMap(prev => {
            const next = { ...prev, [nodeId]: svg };
            if (historyId) {
              const stored = sessionStoreRef.current.get(historyId);
              if (stored) {
                const updated = { ...stored, wireframeMap: next };
                sessionStoreRef.current.set(historyId, updated);
                dbSet('canvas-session', historyId, updated).catch(() => {});
              }
            }
            return next;
          });
        })
        .catch(() => { /* silently skip failed nodes */ });
    }
  }, []);

  /* ─── Real URL audit ──────────────────────────────────────────────── */

  const startAudit = useCallback(async (targetUrl?: string) => {
    if (isAuditing) return;
    if (auditAbortRef.current) auditAbortRef.current.cancelled = true;
    const token = { cancelled: false };
    auditAbortRef.current = token;

    setIsAuditing(true);
    setAuditError(null);
    setRunMode('single');
    setAgentOpen(false);
    setRealFindings([]);
    setScreenshotMap({});
    setWireframeMap({});
    setVideoMap({});
    setElementMap({});
    setAnnotationsMap({});

    const t0 = Date.now();
    const auditUrl = targetUrl ?? url;
    if (targetUrl) setUrl(targetUrl);

    // Optimistic: show root node crawling immediately
    const rawHost = extractHost(auditUrl);
    const optimisticTree: TreeNode = {
      id: 'opt-root', tag: 'Entry', label: rawHost, path: '/', status: 'crawling',
      defects: { ux: 0, ui: 0, a11y: 0 }, children: [],
    };
    const optimisticSession: Session = { host: rawHost, label: rawHost, sessionId: 'opt', tree: optimisticTree };
    setSession(optimisticSession);
    setSelectedNodeId('opt-root');
    setDiscoveredIds(new Set(['opt-root']));
    setStatusOverrides({ 'opt-root': 'crawling' });
    setDefectOverrides({});
    setCrawlProgress({ current: '/', done: 0, total: 1 });
    setShowPanel(false);

    try {
      const canonicalUrl = auditUrl.trim().startsWith('http') ? auditUrl.trim() : 'https://' + auditUrl.trim();
      const res = await fetch('/api/audit/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: canonicalUrl, maxPages: 6 }),
      });

      if (token.cancelled) return;

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error((err as { error?: string }).error || 'Audit failed');
      }

      const data = await res.json() as {
        nodes: Array<{ id: string; label: string; kind: string; url: string; hasScreenshot: boolean }>;
        edges: Array<{ source: string; target: string }>;
        screenshots: Record<string, string>;
        elementMap?: Record<string, ClickableElement[]>;
        videoMap?: Record<string, string>;
        script: { events: Array<{ kind: string; nodeId?: string; severity?: string }> };
        meta: { origin: string; pagesScanned: number; durationMs: number };
      };

      if (token.cancelled) return;

      const host = data.meta.origin.replace(/^https?:\/\//, '').replace(/^www\./, '');
      const label = host.split('.')[0];
      const tree = buildTreeFromApiNodes(data.nodes, data.edges, data.script);
      const newSession: Session = { host, label, sessionId: 'live-' + Date.now(), tree };

      const findings: RealFinding[] = data.script.events
        .filter(e => e.kind === 'finding' && e.nodeId)
        .map(e => ({
          nodeId: e.nodeId!,
          nodeLabel: data.nodes.find(n => n.id === e.nodeId)?.label || '',
          severity: (e.severity || 'low') as RealFinding['severity'],
          message: (e as { utterance?: string }).utterance || '',
          rule: '',
        }));

      const shots = data.screenshots || {};
      const elMap: Record<string, ClickableElement[]> = data.elementMap || {};
      const vids: Record<string, string> = data.videoMap || {};

      setSession(newSession);
      setSelectedNodeId(tree.id);
      setScreenshotMap(shots);
      setVideoMap(vids);
      setRealFindings(findings);
      setElementMap(elMap);
      setDiscoveredIds(null);
      setStatusOverrides({});
      setDefectOverrides({});
      setCrawlProgress({ current: null, done: data.meta.pagesScanned, total: data.meta.pagesScanned });
      setShowPanel(true);

      const historyId = addToHistory(canonicalUrl, newSession, Date.now() - t0, findings, shots, elMap, vids);

      // Fire parallel AI wireframe generation for each captured page
      if (Object.keys(shots).length > 0) {
        generateWireframes(shots, historyId);
      }

    } catch (err) {
      if (token.cancelled) return;
      const msg = err instanceof Error ? err.message : 'Audit failed';
      setAuditError(msg);

      // Fallback: use mock tree so canvas isn't empty
      const fallback = makeTreeForUrl(auditUrl);
      setSession(fallback as Session);
      setSelectedNodeId(fallback.tree.id);
      setDiscoveredIds(null);
      setStatusOverrides({});
      setDefectOverrides({});
    } finally {
      if (!token.cancelled) {
        setIsAuditing(false);
        setCrawlProgress({ current: null, done: 0, total: 0 });
      }
    }
  }, [url, isAuditing, addToHistory, generateWireframes]);

  /* ─── Agent run (parallel per-target with SSE stream) ─────────────── */

  const agentAbortRef = useRef<AbortController | null>(null);

  const runAgentTargets = useCallback(async (targets: UITarget[]) => {
    if (agentRunning || targets.length === 0) return;

    agentAbortRef.current?.abort();
    const abort = new AbortController();
    agentAbortRef.current = abort;

    setAgentRunning(true);
    setRunMode('multi');
    setAgentOpen(false);
    setShowPanel(false);
    setAgentSites([]);

    // Placeholder sites: show all targets as amber/crawling while running
    const placeholders: AgentSite[] = targets.map(t => {
      let hostname = t.url;
      try { hostname = new URL(t.url.startsWith('http') ? t.url : 'https://' + t.url).hostname; } catch { /* keep raw */ }
      return {
        id: t.id, name: t.name, url: t.url, env: t.env, state: 'amber',
        pages: 0, findings: 0,
        tree: { id: t.id + '-root', tag: 'Entry', label: hostname, path: '/', status: 'crawling', defects: { ux: 0, ui: 0, a11y: 0 }, children: [] },
      };
    });
    setAgentSites(placeholders);

    // Open SSE stream for live updates
    const streamUpdates = async () => {
      try {
        const sseRes = await fetch('/api/agent/stream', { signal: abort.signal });
        if (!sseRes.body) return;
        const reader = sseRes.body.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = dec.decode(value);
          for (const chunk of text.split('\n\n')) {
            if (!chunk.startsWith('data:')) continue;
            try {
              const run = JSON.parse(chunk.slice(5)) as BackendRun;
              setAgentSites(prev => prev.map(site => {
                const siteHost = site.url.replace(/^https?:\/\//, '').replace(/^www\./, '');
                const runHost = run.url.replace(/^https?:\/\//, '').replace(/^www\./, '');
                if (siteHost !== runHost && site.id !== run.targetId) return site;
                const target = targets.find(t => t.id === run.targetId || t.url.includes(runHost)) || targets[0];
                return convertRunToSite(run, target);
              }));
            } catch { /* skip malformed */ }
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.warn('[agent stream]', err);
        }
      }
    };
    streamUpdates(); // fire-and-forget

    // Run all targets. Call once per target in parallel so they run concurrently.
    try {
      const apiTargets = targets.map(t => ({
        id: t.id,
        url: t.url.startsWith('http') ? t.url : 'https://' + t.url,
        name: t.name,
        enabled: true,
      }));

      // Parallel: one fetch per target
      const runPromises = apiTargets.map(target =>
        fetch('/api/agent/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targets: [target] }),
          signal: abort.signal,
        }).then(r => r.ok ? r.json() as Promise<{ runs: BackendRun[] }> : Promise.resolve({ runs: [] }))
          .catch(() => ({ runs: [] as BackendRun[] }))
      );

      const results = await Promise.all(runPromises);
      abort.abort(); // close SSE

      // Build final site list from results
      const finalSites: AgentSite[] = [];
      const allRuns: BackendRun[] = [];

      results.forEach((res, i) => {
        const run = res.runs?.[0];
        if (run) {
          allRuns.push(run);
          finalSites.push(convertRunToSite(run, targets[i]));
        } else {
          // Keep placeholder as red/error
          finalSites.push({ ...placeholders[i], state: 'red' });
        }
      });

      setAgentSites(finalSites);

      // Collect screenshots from all runs into screenshotMap so Annotate works
      const agentShots: Record<string, string> = {};
      for (const run of allRuns) {
        for (const n of run.crawlResult?.nodes || []) {
          if (n.screenshot) agentShots[n.id] = n.screenshot;
        }
        for (const p of run.partialCrawl || []) {
          if (p.screenshot) agentShots[p.id] = p.screenshot;
        }
      }
      if (Object.keys(agentShots).length > 0) {
        setScreenshotMap(prev => ({ ...prev, ...agentShots }));
      }

      // Add each run to history
      const t0 = Date.now();
      for (let i = 0; i < allRuns.length; i++) {
        const run = allRuns[i];
        const target = targets[i];
        if (!run) continue;

        const findings: RealFinding[] = (run.crawlResult?.findings || []).map(f => ({
          nodeId: f.nodeId,
          nodeLabel: f.nodeLabel,
          severity: (f.severity === 'medium' ? 'medium' : f.severity) as RealFinding['severity'],
          message: f.message,
          rule: f.rule,
        }));

        const shots: Record<string, string> = {};
        for (const n of run.crawlResult?.nodes || []) {
          if (n.screenshot) shots[n.id] = n.screenshot;
        }

        const tree = run.crawlResult ? buildTreeFromCrawlResult(run.crawlResult) : finalSites[i].tree;
        let hostname = target.url;
        try { hostname = new URL(target.url.startsWith('http') ? target.url : 'https://' + target.url).hostname; } catch { /* keep raw */ }

        const agentSession: Session = {
          host: hostname, label: hostname.split('.')[0],
          sessionId: run.runId, tree,
        };

        const dur = run.updatedAt && run.startedAt ? run.updatedAt - run.startedAt : Date.now() - t0;
        const agentHistoryId = addToHistory(target.url, agentSession, dur, findings, shots);

        // Generate AI wireframes for this target's screenshots
        if (Object.keys(shots).length > 0) {
          generateWireframes(shots, agentHistoryId);
        }
      }

    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error('[agent run]', err);
      }
    } finally {
      setAgentRunning(false);
    }
  }, [agentRunning, addToHistory, generateWireframes]);

  /* ─── Restore session from history ───────────────────────────────── */

  const restoreSession = useCallback((historyId: string) => {
    const stored = sessionStoreRef.current.get(historyId);
    if (!stored) return;
    setSession(stored.session);
    setSelectedNodeId(stored.session.tree.id);
    setScreenshotMap(stored.screenshotMap);
    setWireframeMap(stored.wireframeMap || {});
    setVideoMap(stored.videoMap || {});
    setRealFindings(stored.realFindings);
    setElementMap(stored.elementMap || {});
    setAnnotationsMap(stored.annotationsMap || {});
    setDiscoveredIds(null);
    setStatusOverrides({});
    setDefectOverrides({});
    setRunMode('single');
    setShowPanel(true);
    setAgentOpen(false);
  }, []);

  /* ─── Crawl stats ─────────────────────────────────────────────────── */

  const crawlStats = useMemo(() => {
    let pages = 0, depth = 0, findings = 0;
    function walk(n: TreeNode, d: number) {
      if (discoveredIds && !discoveredIds.has(n.id)) return;
      pages++; depth = Math.max(depth, d);
      const def = defectOverrides[n.id] || n.defects;
      findings += def.ux + def.ui + def.a11y;
      (n.children || []).forEach(c => walk(c, d + 1));
    }
    walk(session.tree, 1);
    return { pages, depth, findings };
  }, [session, discoveredIds, defectOverrides]);

  const cols = `280px 1fr ${(showPanel || agentOpen) ? '400px' : '0px'}`;

  const selectedNode = useMemo(() => {
    let n = findNodeInTree(session.tree, selectedNodeId);
    if (n) return n;
    for (const s of agentSites) { n = findNodeInTree(s.tree, selectedNodeId); if (n) return n; }
    for (const s of AGENT_RUN.sites) { n = findNodeInTree(s.tree, selectedNodeId); if (n) return n; }
    return session.tree;
  }, [session, selectedNodeId, agentSites]);

  // In multi-site mode resolve host from whichever AgentSite owns the selected node
  const selectedNodeHost = useMemo(() => {
    const allSites = agentSites.length > 0 ? agentSites : AGENT_RUN.sites;
    for (const s of allSites) {
      if (findNodeInTree(s.tree, selectedNodeId)) {
        try { return new URL(s.url.startsWith('http') ? s.url : 'https://' + s.url).hostname; } catch { return s.url; }
      }
    }
    return session.host;
  }, [selectedNodeId, agentSites, session.host]);

  return (
    <div className="app">
      <Topbar
        theme={theme} setTheme={setTheme}
        url={url} setUrl={setUrl}
        onAuditStart={startAudit} isAuditing={isAuditing}
        onFolderMenu={() => setFolderOpen(true)}
        onAgentToggle={() => { setAgentOpen(o => !o); if (!agentOpen) setShowPanel(false); }}
        agentOpen={agentOpen}
        auditError={auditError}
      />
      <div className="stage" style={{ gridTemplateColumns: cols }}>
        <Sidebar
          activeId={activeHistory}
          setActiveId={setActiveHistory}
          crawlStats={crawlStats}
          historyItems={historyItems}
          onRestoreSession={restoreSession}
        />
        <Canvas
          session={session}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={id => { setSelectedNodeId(id); setShowPanel(true); setAgentOpen(false); }}
          collapsedIds={collapsedIds}
          onToggle={onToggleCollapse}
          isAuditing={isAuditing}
          crawlProgress={crawlProgress}
          discoveredIds={discoveredIds}
          statusOverrides={statusOverrides}
          defectOverrides={defectOverrides}
          runMode={runMode}
          setRunMode={setRunMode}
          agentSites={agentSites}
          agentRunning={agentRunning}
          screenshotMap={screenshotMap}
        />
        {agentOpen
          ? <AgentPanel
              onClose={() => setAgentOpen(false)}
              onRunNow={runAgentTargets}
              isRunning={agentRunning}
              targets={agentTargets}
              setTargets={fn => setAgentTargets(fn)}
            />
          : showPanel && selectedNode
            ? <RightPanel
                onClose={() => setShowPanel(false)}
                selectedNode={selectedNode}
                session={session}
                hostOverride={runMode === 'multi' ? selectedNodeHost : undefined}
                screenshotMap={screenshotMap}
                wireframeMap={wireframeMap}
                videoMap={videoMap}
                realFindings={realFindings}
                elementMap={elementMap}
                annotationsMap={annotationsMap}
                onAnnotate={(nodeId, nodeLabel, mode) => setAnnotatingNode({ nodeId, mode, nodeLabel })}
              />
            : null}
      </div>
      {folderOpen && <FolderMenu onClose={() => setFolderOpen(false)} onStartWebAudit={u => { setFolderOpen(false); startAudit(u); }}/>}
      {annotatingNode && (
        <AnnotationEditor
          imageUrl={screenshotMap[annotatingNode.nodeId]}
          wireframeSvg={wireframeMap[annotatingNode.nodeId]}
          mode={annotatingNode.mode}
          nodeLabel={annotatingNode.nodeLabel}
          initial={annotationsMap[annotatingNode.nodeId] ?? []}
          onSave={annotations => saveAnnotations(annotatingNode.nodeId, annotations)}
          onClose={() => setAnnotatingNode(null)}
        />
      )}
    </div>
  );
}

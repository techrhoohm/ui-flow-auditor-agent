'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  IcGlobe, IcLock, IcFolder, IcCaret, IcAgent, IcExport,
  IcPlus, IcMinus, IcMaximize, IcClose, IcSun, IcMoon,
  IcSearch, IcChevronRight, IcPlay, IcSpark, IcCamera, IcLayers, IcTarget,
} from '@/components/icons';
import { NodeThumb } from '@/components/canvas/NodeThumb';
import { getScreenshotForNode } from '@/components/canvas/screenshots';
import { getWireframeForNode } from '@/components/canvas/wireframes';
import type { TreeNode, HistoryItem } from '@/lib/prototype-data';
import { SITE_TREE, HISTORY, FINDINGS, AGENT_RUN } from '@/lib/prototype-data';
import { makeTreeForUrl, bfsOrder } from '@/lib/prototype-crawl';

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
  theme: string;
  setTheme: (t: string) => void;
  url: string;
  setUrl: (u: string) => void;
  onAuditStart: () => void;
  isAuditing: boolean;
  onFolderMenu: () => void;
  onAgentToggle: () => void;
  agentOpen: boolean;
}

function Topbar({ theme, setTheme, url, setUrl, onAuditStart, isAuditing, onFolderMenu, onAgentToggle, agentOpen }: TopbarProps) {
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
        <span className="pill-web">
          <IcGlobe w={10} h={10} strokeWidth={2}/> Web
        </span>
        <label className="url-bar">
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
        <button className="btn btn-icon" onClick={onFolderMenu} title="Audit a local flow">
          <IcFolder w={14} h={14}/>
        </button>
        <div className="btn-split">
          <button>Recent <IcCaret w={12} h={12} className="caret"/></button>
        </div>
      </div>

      <div className="topbar-right">
        <ThemeSwitch theme={theme} setTheme={setTheme}/>
        <button className={'btn ' + (agentOpen ? 'btn-on' : '')} onClick={onAgentToggle}>
          <IcAgent w={13} h={13}/> Agent
        </button>
        <div className="btn-split">
          <button><span className="dot dot-accent"/> Sonnet 4.6 · balanced <IcCaret w={12} h={12} className="caret"/></button>
        </div>
        <button className="btn">
          <IcExport w={13} h={13}/> Export
        </button>
        <button className={'btn ' + (isAuditing ? '' : 'btn-primary')} onClick={onAuditStart}>
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
}

function Sidebar({ activeId, setActiveId, crawlStats }: SidebarProps) {
  const todayItems = HISTORY.slice(0, 6);
  const earlierItems = HISTORY.slice(6);

  return (
    <aside className="sidebar">
      <div className="side-block">
        <div className="side-label">Crawl</div>
        <div className="stats-grid">
          <div className="stat">
            <div className="stat-num">{crawlStats.pages}</div>
            <div className="stat-lbl">Pages</div>
          </div>
          <div className="stat">
            <div className="stat-num">{crawlStats.depth}</div>
            <div className="stat-lbl">Depth</div>
          </div>
          <div className="stat">
            <div className="stat-num">{crawlStats.findings}</div>
            <div className="stat-lbl">Findings</div>
          </div>
        </div>
      </div>

      <div className="side-block">
        <div className="side-label">
          Manual QA
          <button className="btn btn-sm">Author</button>
        </div>
        <div className="side-hint">Add acceptance criteria the agent should verify on every audit.</div>
      </div>

      <div className="side-block">
        <div className="side-label">
          Visual baseline
          <button className="btn btn-sm">Set</button>
        </div>
        <div className="side-hint">Compares future audits pixel-by-pixel against the saved frame.</div>
      </div>

      <div className="side-block">
        <div className="side-label">History</div>
        <div className="history-divider">Today</div>
        {todayItems.map(h => (
          <HistoryItemCard key={h.id} item={h} active={activeId === h.id} onClick={() => setActiveId(h.id)}/>
        ))}
        {earlierItems.length > 0 && (
          <>
            <div className="history-divider" style={{ marginTop: 14 }}>Earlier</div>
            {earlierItems.map(h => (
              <HistoryItemCard key={h.id} item={h} active={activeId === h.id} onClick={() => setActiveId(h.id)}/>
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
            <span key={i} className={'badge ' + b.sev}>
              <span className="b-dot"/>{b.count}
            </span>
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
}

function TreeNodeCard({ node, selectedId, onSelect, collapsedIds, onToggle, discoveredIds, statusOverrides, defectOverrides }: TreeNodeProps) {
  if (discoveredIds && !discoveredIds.has(node.id)) return null;

  const collapsed = collapsedIds.has(node.id);
  const status = statusOverrides[node.id] || node.status;
  const defects = defectOverrides[node.id] || node.defects;
  const visibleChildren = (node.children || []).filter(c => !discoveredIds || discoveredIds.has(c.id));
  const hasChildren = visibleChildren.length > 0;
  const totalDefects = defects.ux + defects.ui + defects.a11y;
  const sev = defects.ux + defects.a11y > 4 ? 'high' : totalDefects > 2 ? 'med' : totalDefects > 0 ? 'low' : 'none';

  return (
    <div className="tree-node-wrap">
      <div
        className={'tree-card ' + (selectedId === node.id ? 'selected ' : '') + 'status-' + status}
        onClick={() => onSelect(node.id)}
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
              : <NodeThumb/>}
        </div>

        <div className="tree-card-foot">
          <div className="tree-card-meta">
            <div className="tree-card-title">{node.label}</div>
            <div className="tree-card-path">{node.path}</div>
          </div>
          <div className="defect-row">
            <Pip kind="ux"   n={defects.ux}/>
            <Pip kind="ui"   n={defects.ui}/>
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
              discoveredIds={discoveredIds} statusOverrides={statusOverrides} defectOverrides={defectOverrides}/>
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
  site: typeof AGENT_RUN.sites[0];
  selectedNodeId: string;
  setSelectedNodeId: (id: string) => void;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
}

function SiteSection({ site, selectedNodeId, setSelectedNodeId, collapsedIds, onToggle }: SiteSectionProps) {
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
        />
      </div>
    </div>
  );
}

/* ─────────────────────────── Canvas ──────────────────────────────────── */

interface CanvasProps {
  session: { host: string; sessionId: string; tree: TreeNode };
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
}

function Canvas({ session, selectedNodeId, setSelectedNodeId, collapsedIds, onToggle,
                  isAuditing, runMode, setRunMode, crawlProgress,
                  discoveredIds, statusOverrides, defectOverrides }: CanvasProps) {
  const [zoom, setZoom] = useState(100);

  return (
    <div className="canvas">
      <div className="canvas-overlay-tr">
        <div className="zoom-pill">
          <button onClick={() => setZoom(z => Math.max(40, z - 10))} aria-label="Zoom out"><IcMinus w={12} h={12}/></button>
          <span className="zoom-val">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} aria-label="Zoom in"><IcPlus w={12} h={12}/></button>
          <button onClick={() => setZoom(100)} aria-label="Fit"><IcMaximize w={12} h={12}/></button>
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
              <span className="run-pill"><span className="run-pill-dot"/> Run {AGENT_RUN.id}</span>
              <span className="run-meta-sep">·</span>
              <span>{AGENT_RUN.sites.length} sites</span>
              <span className="run-meta-sep">·</span>
              <span>{AGENT_RUN.startedAt} → {AGENT_RUN.finishedAt}</span>
            </div>
            <div className="run-banner-actions">
              <button className="btn btn-sm">Compare to last run</button>
              <button className="btn btn-sm btn-primary"><IcPlay w={10} h={10}/> Re-run</button>
            </div>
          </div>
        )}
        <div
          className={runMode === 'multi' ? 'multi-stage' : 'tree-root'}
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: runMode === 'multi' ? 'top left' : 'top center' }}
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
              />
            : AGENT_RUN.sites.map(site => (
                <SiteSection
                  key={site.id}
                  site={site}
                  selectedNodeId={selectedNodeId}
                  setSelectedNodeId={setSelectedNodeId}
                  collapsedIds={collapsedIds}
                  onToggle={onToggle}
                />
              ))}
        </div>
      </div>

      <div className="nora-anchor">
        <div className="nora-bubble">
          {isAuditing
            ? <>Crawling <b>{session.host}{crawlProgress.current}</b>… {crawlProgress.done}/{crawlProgress.total}</>
            : runMode === 'multi'
              ? <>Agent run complete · <b>{AGENT_RUN.sites.length} sites</b> audited.</>
              : <>Audit complete on <b>{session.host}</b>. Click a node for details.</>}
        </div>
        <div className="nora-fig"/>
      </div>

      <div className="statusbar">
        <span className={'live-dot ' + (isAuditing ? 'go' : '')}/>
        <span>{isAuditing ? 'Crawling' : 'Idle'}</span>
        <span className="sep"/>
        <span>{runMode === 'multi' ? `${AGENT_RUN.sites.length} sites` : session.host}</span>
        {isAuditing && (<>
          <span className="sep"/>
          <span>{crawlProgress.done}/{crawlProgress.total} pages</span>
        </>)}
        <span className="sep"/>
        <span>Sonnet 4.6</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── PreviewCard ─────────────────────────────── */

function PreviewCard({ node, host }: { node: TreeNode; host: string }) {
  const [view, setView] = useState<'screenshot' | 'wireframe'>('screenshot');
  const [annotations, setAnnotations] = useState(true);
  const url = 'https://' + host + (node.path === '/' ? '' : node.path);

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
        </div>
        <button
          className={'chip-btn ' + (annotations ? 'on' : '')}
          onClick={() => setAnnotations(a => !a)}
          title="Show finding hotspots">
          <IcTarget w={11} h={11}/> Hotspots
        </button>
      </div>
      <div className={'preview-img ' + (view === 'screenshot' ? 'is-screenshot ' : '') + (annotations ? '' : 'no-annot')}>
        {view === 'screenshot' ? getScreenshotForNode(node) : getWireframeForNode(node)}
        <div className="preview-overlay">
          <span className="ovl-chip"><span className="live-dot go"/> captured 12 min ago · full page · 3.2 MB</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── RightPanel ──────────────────────────────── */

interface RightPanelProps {
  onClose: () => void;
  selectedNode: TreeNode;
  session: { host: string; sessionId: string; tree: TreeNode };
}

function RightPanel({ onClose, selectedNode, session }: RightPanelProps) {
  const node = selectedNode;
  const host = session.host;
  const [tab, setTab] = useState<'findings' | 'tests' | 'scripts' | 'timeline'>('findings');
  const [catFilter, setCatFilter] = useState('all');

  const allFindings = [
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
            <PreviewCard node={node} host={host}/>

            <div className="sev-grid">
              <div className="sev-card sev-high">
                <div className="sev-label">High</div>
                <div className="sev-num">{totals.high}</div>
              </div>
              <div className="sev-card sev-med">
                <div className="sev-label">Medium</div>
                <div className="sev-num">{totals.med}</div>
              </div>
              <div className="sev-card sev-low">
                <div className="sev-label">Low</div>
                <div className="sev-num">{totals.low}</div>
              </div>
            </div>

            <div className="cat-filter">
              {[
                { k: 'all',  l: 'All',           n: allFindings.length },
                { k: 'ux',   l: 'UX',            n: FINDINGS.ux.length },
                { k: 'ui',   l: 'UI',            n: FINDINGS.ui.length },
                { k: 'a11y', l: 'Accessibility', n: FINDINGS.a11y.length },
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
            </div>
          </>
        )}
        {tab === 'tests' && <TestCasesView/>}
        {tab === 'scripts' && (
          <EmptyState
            title="No scripts yet"
            body="Drop Playwright or custom scripts the agent should run on every audit pass."
            cta="Add script"/>
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
            <span className="testcase-stats">
              {c.passes} pass · {c.fails} fail · {c.steps} steps
            </span>
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

function FolderMenu({ onClose }: { onClose: () => void }) {
  const sources = [
    { id: 'macos',   name: 'macOS',   sub: 'Capture native windows via Accessibility API' },
    { id: 'windows', name: 'Windows', sub: 'Hook UI Automation for any app' },
    { id: 'ios',     name: 'iOS',     sub: 'Mirror device via Xcode bridge' },
    { id: 'android', name: 'Android', sub: 'ADB bridge — emulator or physical device' },
    { id: 'figma',   name: 'Figma',   sub: 'Audit prototypes & frames from a file URL' },
    { id: 'folder',  name: 'Folder',  sub: 'Local directory of screenshots or HTML' },
  ];
  return (
    <div className="fm-backdrop" onClick={onClose}>
      <div className="fm-panel" onClick={e => e.stopPropagation()}>
        <div className="fm-head">
          <div>
            <div className="fm-kicker">Audit a native flow</div>
            <div className="fm-title">Pick a source</div>
          </div>
          <button className="rp-close" onClick={onClose}><IcClose w={14} h={14}/></button>
        </div>
        <div className="fm-grid">
          {sources.map(s => (
            <button key={s.id} className="fm-card" onClick={onClose}>
              <div className="fm-icon"><IcFolder w={18} h={18}/></div>
              <div className="fm-card-meta">
                <div className="fm-card-title">{s.name}</div>
                <div className="fm-card-sub">{s.sub}</div>
              </div>
              <IcChevronRight w={14} h={14} strokeWidth={1.5}/>
            </button>
          ))}
        </div>
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

interface AgentTarget {
  id: string; url: string; name: string; env: string;
  state: 'green' | 'amber' | 'red';
}

function AgentPanel({ onClose, onRunNow }: { onClose: () => void; onRunNow: () => void }) {
  const [schedule, setSchedule] = useState('daily');
  const [visualDiff, setVisualDiff] = useState(5);
  const [minSev, setMinSev] = useState('med');
  const [github, setGithub] = useState(false);
  const [slack, setSlack] = useState(true);
  const [targets, setTargets] = useState<AgentTarget[]>(
    AGENT_RUN.sites.map(s => ({ id: s.id, url: s.url, name: s.name, env: s.env, state: s.state }))
  );
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');

  const addTarget = () => {
    if (!newUrl.trim()) return;
    setTargets(t => [...t, { id: 't' + Date.now(), url: newUrl.trim(), name: newName.trim() || newUrl.trim(), env: 'production', state: 'green' }]);
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
            <div className="ap-status-row"><span className="live-dot go"/><span><b>Idle</b> · next run in 4h 12m</span></div>
            <div className="ap-status-sub">17 runs today · 4 regressions filed</div>
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
        <button className="btn btn-primary ap-run" onClick={onRunNow} disabled={targets.length === 0}>
          <IcPlay w={11} h={11}/> Run now · {targets.length} site{targets.length === 1 ? '' : 's'}
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

  const onToggleCollapse = (id: string) => {
    setCollapsedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const startAudit = () => {
    if (auditAbortRef.current) auditAbortRef.current.cancelled = true;
    const token = { cancelled: false };
    auditAbortRef.current = token;

    const next = makeTreeForUrl(url);
    setSession(next as Session);
    setSelectedNodeId(next.tree.id);
    setRunMode('single');
    setAgentOpen(false);

    const order = bfsOrder(next.tree);
    setDiscoveredIds(new Set([next.tree.id]));
    setStatusOverrides({ [next.tree.id]: 'crawling' });
    setDefectOverrides(Object.fromEntries(order.map(n => [n.id, { ux: 0, ui: 0, a11y: 0 }])));
    setIsAuditing(true);
    setShowPanel(true);
    setCrawlProgress({ current: next.tree.path, done: 0, total: order.length });

    let i = 0;
    const tick = () => {
      if (token.cancelled) return;
      const n = order[i];
      setStatusOverrides(prev => ({ ...prev, [n.id]: n.status === 'blocked' ? 'blocked' : 'done' }));
      setDefectOverrides(prev => ({ ...prev, [n.id]: n.defects }));
      setDiscoveredIds(prev => { const nx = new Set(prev); (n.children || []).forEach(c => nx.add(c.id)); return nx; });
      i++;
      if (i < order.length) {
        setStatusOverrides(prev => ({ ...prev, [order[i].id]: 'crawling' }));
        setCrawlProgress({ current: order[i].path, done: i, total: order.length });
        setTimeout(tick, 420 + Math.random() * 220);
      } else {
        setIsAuditing(false);
        setStatusOverrides({});
        setDefectOverrides({});
        setDiscoveredIds(null);
        setCrawlProgress({ current: null, done: order.length, total: order.length });
      }
    };
    setTimeout(tick, 480);
  };

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
    for (const s of AGENT_RUN.sites) { n = findNodeInTree(s.tree, selectedNodeId); if (n) return n; }
    return session.tree;
  }, [session, selectedNodeId]);

  return (
    <div className="app">
      <Topbar
        theme={theme} setTheme={setTheme}
        url={url} setUrl={setUrl}
        onAuditStart={startAudit} isAuditing={isAuditing}
        onFolderMenu={() => setFolderOpen(true)}
        onAgentToggle={() => { setAgentOpen(o => !o); if (!agentOpen) setShowPanel(false); }}
        agentOpen={agentOpen}
      />
      <div className="stage" style={{ gridTemplateColumns: cols }}>
        <Sidebar activeId={activeHistory} setActiveId={setActiveHistory} crawlStats={crawlStats}/>
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
        />
        {agentOpen
          ? <AgentPanel onClose={() => setAgentOpen(false)} onRunNow={() => { setRunMode('multi'); setAgentOpen(false); setShowPanel(false); }}/>
          : showPanel && selectedNode
            ? <RightPanel onClose={() => setShowPanel(false)} selectedNode={selectedNode} session={session}/>
            : null}
      </div>
      {folderOpen && <FolderMenu onClose={() => setFolderOpen(false)}/>}
    </div>
  );
}

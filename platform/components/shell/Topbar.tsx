"use client";

type Props = {
  onStartAudit: () => void;
  disabled?: boolean;
};

export function Topbar({ onStartAudit, disabled = true }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/70 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-violet-400/40 bg-violet-500/10 font-mono text-[11px] text-violet-300">
          N
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-medium text-zinc-100">
            UI Flow Auditor
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
            Milestone 1 · Platform shell
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-zinc-500">
          target: <span className="text-zinc-300">VitalsApp</span>
        </span>
        <button
          type="button"
          onClick={onStartAudit}
          disabled={disabled}
          title={disabled ? "Wired up in Milestone 2" : "Start an audit"}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:enabled:border-violet-400/40 hover:enabled:bg-violet-500/10 hover:enabled:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start audit
        </button>
      </div>
    </header>
  );
}

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/50">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          Runs
        </div>
      </div>

      <div className="flex-1 px-4 py-6 text-[12px] leading-relaxed text-zinc-500">
        <p>No audits yet.</p>
        <p className="mt-1 text-zinc-600">
          Run history appears here once Milestone 2 is wired up.
        </p>
      </div>

      <div className="border-t border-zinc-800 px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          Avatar
        </div>
        <div className="mt-1 text-[12px] text-zinc-300">Nora</div>
        <div className="text-[11px] text-zinc-500">silent · detail-bound</div>
      </div>
    </aside>
  );
}

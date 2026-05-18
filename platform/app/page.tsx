"use client";

import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { Nora } from "@/components/nora/Nora";
import { IDLE_SNAPSHOT } from "@/components/nora/states";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { vitalsAppEdges, vitalsAppNodes } from "@/lib/fixtures";

export default function Home() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#08080a] text-zinc-100">
      <Topbar onStartAudit={() => {}} disabled />

      <div className="flex min-h-0 flex-1">
        <Sidebar />

        <main className="relative flex-1 overflow-hidden">
          <FlowCanvas nodes={vitalsAppNodes} edges={vitalsAppEdges} />

          <div className="pointer-events-none absolute bottom-6 left-6 z-10">
            <Nora snapshot={IDLE_SNAPSHOT} />
          </div>
        </main>
      </div>
    </div>
  );
}

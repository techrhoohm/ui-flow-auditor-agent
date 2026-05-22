import { getCurrentRun } from "@/lib/agent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let closed = false;

  req.signal.addEventListener("abort", () => { closed = true; });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Keep-alive comment so proxies don't close idle connections
      const keepAlive = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: keep-alive\n\n`)); } catch { closed = true; }
      }, 15000);

      let noRunTicks = 0;
      const MAX_NO_RUN_TICKS = 20; // wait up to 10s for run to appear

      try {
        while (!closed) {
          const run = await getCurrentRun().catch(() => null);

          if (!run?.runId) {
            noRunTicks++;
            if (noRunTicks > MAX_NO_RUN_TICKS) break;
          } else {
            noRunTicks = 0;
            send(run);
            if (run.state === "done" || run.state === "error") break;
          }

          await new Promise<void>((r) => setTimeout(r, 600));
        }
      } finally {
        clearInterval(keepAlive);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

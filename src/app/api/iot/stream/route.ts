import type { NextRequest } from "next/server";
import { onAck, onTelemetry } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const runCleanup = () => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      const unsubscribeTelemetry = onTelemetry((message) => {
        sendEvent("telemetry", message);
      });

      const unsubscribeAck = onAck((ack) => {
        sendEvent("ack", ack);
      });

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
      }, 15000);

      cleanup = () => {
        clearInterval(keepAlive);
        unsubscribeTelemetry();
        unsubscribeAck();
        controller.close();
      };

      request.signal.addEventListener("abort", runCleanup);
      controller.enqueue(encoder.encode(`: connected\n\n`));
    },
    cancel() {
      runCleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

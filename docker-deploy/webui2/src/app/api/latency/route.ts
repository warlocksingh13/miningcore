import net from "net";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface LatencyRequest {
  host?: string;
  port?: number;
  timeout?: number;
}

export async function POST(request: Request) {
  let payload: LatencyRequest;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const host = payload.host?.trim();
  const port = Number(payload.port);
  const timeout = Math.min(Math.max(Number(payload.timeout) || 3000, 500), 10_000);

  if (!host || Number.isNaN(port) || port <= 0) {
    return NextResponse.json({ error: "host and port are required" }, { status: 400 });
  }

  const result = await new Promise<{ latency: number | null; error?: string }>((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host, port }, () => {
      const latency = Date.now() - started;
      socket.destroy();
      resolve({ latency });
    });

    const handleFailure = (error: string) => () => {
      socket.destroy();
      resolve({ latency: null, error });
    };

    socket.setTimeout(timeout, handleFailure("timeout"));
    socket.on("error", handleFailure("connect-error"));
  });

  return NextResponse.json(result);
}

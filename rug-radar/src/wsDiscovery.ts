// Real-time launch discovery over the public Solana websocket RPC, replacing
// discovery.ts's signature-polling as the primary source: a logsSubscribe
// with a `mentions` filter on the pump.fun program pushes every transaction
// that touches it (confirmed live — this is still every buy/sell/create, not
// just creates, since `mentions` isn't instruction-specific), but the log
// lines that arrive with each push are enough to tell create instructions
// apart client-side (wsLogParser.ts) without an extra RPC call per
// transaction. Only the rare subset that are actually creates trigger a
// getTransaction call, unlike discovery.ts's poll which had to fetch every
// scanned signature to find out. See rug-radar/README.md for how this was
// confirmed against real traffic.
//
// discovery.ts's poller stays in use as a backstop (see poller.ts/server.ts):
// this watcher only sees launches created after it connects, and a dropped
// connection can lose events during the reconnect gap.

import { PUMP_FUN_PROGRAM_ID } from "./pumpfun.js";
import { resolveLaunchFromSignature } from "./discovery.js";
import { detectCreateInstruction } from "./wsLogParser.js";
import type { DiscoveredLaunch } from "./discovery.js";
import type { SolanaRpcClient } from "./rpc.js";

// The subset of the standard WebSocket client API this module needs,
// expressed as an interface (not the DOM/Node WebSocket type) so tests can
// inject a fake without pulling in "DOM" lib types or a websocket package.
export interface WebSocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

function defaultWebSocketFactory(url: string): WebSocketLike {
  const Ctor = (globalThis as Record<string, unknown>).WebSocket as
    | (new (url: string) => WebSocketLike)
    | undefined;
  if (!Ctor) {
    throw new Error(
      "No global WebSocket constructor available. Node 20 needs --experimental-websocket " +
        "(set e.g. via NODE_OPTIONS), or pass a custom wsFactory.",
    );
  }
  return new Ctor(url);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SignatureFetcher = Pick<SolanaRpcClient, "getTransaction">;

export interface WatchLaunchesOptions {
  onLaunch: (launch: DiscoveredLaunch) => void;
  onError?: (err: unknown) => void;
  wsFactory?: WebSocketFactory;
  sleep?: (ms: number) => Promise<void>;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  // Bounds memory for the recently-seen-signature dedup set (a resubscribe
  // after a reconnect can redeliver recent notifications).
  maxSeenSignatures?: number;
  // Passed through to resolveLaunchFromSignature's retry-on-not-found-yet
  // (see discovery.ts's ResolveLaunchOptions) — matters most here, since a
  // freshly-pushed log notification is exactly when getTransaction is most
  // likely to lag behind on the public RPC's multi-node cluster.
  resolveRetries?: number;
  resolveBaseDelayMs?: number;
}

const DEFAULT_RECONNECT_BASE_MS = 1000;
const DEFAULT_RECONNECT_MAX_MS = 30_000;
const DEFAULT_MAX_SEEN_SIGNATURES = 500;

// Subscribes to pump.fun program logs and calls `onLaunch` for each create it
// finds, reconnecting with exponential backoff if the connection drops.
// Returns a handle to stop watching.
export class LaunchWatcher {
  private readonly rpc: SignatureFetcher;
  private readonly opts: WatchLaunchesOptions;
  private readonly wsFactory: WebSocketFactory;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly seen = new Set<string>();
  private readonly seenOrder: string[] = [];
  private stopped = true;
  private attempt = 0;
  private ws: WebSocketLike | null = null;

  constructor(
    private readonly wsUrl: string,
    rpc: SignatureFetcher,
    opts: WatchLaunchesOptions,
  ) {
    this.rpc = rpc;
    this.opts = opts;
    this.wsFactory = opts.wsFactory ?? defaultWebSocketFactory;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.ws?.close();
    this.ws = null;
  }

  private connect(): void {
    if (this.stopped) return;

    let ws: WebSocketLike;
    try {
      ws = this.wsFactory(this.wsUrl);
    } catch (err) {
      this.opts.onError?.(err);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "logsSubscribe",
          params: [{ mentions: [PUMP_FUN_PROGRAM_ID] }, { commitment: "confirmed" }],
        }),
      );
    };

    ws.onmessage = (event) => this.handleMessage(event.data);
    ws.onerror = (err) => this.opts.onError?.(err);
    ws.onclose = () => {
      if (this.stopped) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    const base = this.opts.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_MS;
    const max = this.opts.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_MS;
    const delay = Math.min(max, base * 2 ** this.attempt);
    this.attempt++;
    this.sleep(delay).then(() => this.connect());
  }

  private handleMessage(raw: unknown): void {
    let msg: unknown;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!isLogsNotification(msg)) return;

    const { signature, err, logs } = msg.params.result.value;
    if (err) return;
    if (!this.markSeen(signature)) return;

    const variant = detectCreateInstruction(PUMP_FUN_PROGRAM_ID, logs);
    if (!variant) return;

    resolveLaunchFromSignature(this.rpc, signature, {
      retries: this.opts.resolveRetries,
      baseDelayMs: this.opts.resolveBaseDelayMs,
      sleep: this.sleep,
    })
      .then((launch) => {
        if (launch) this.opts.onLaunch(launch);
      })
      .catch((err2) => this.opts.onError?.(err2));
  }

  // Returns true the first time a signature is seen, false on repeats.
  private markSeen(signature: string): boolean {
    if (this.seen.has(signature)) return false;
    this.seen.add(signature);
    this.seenOrder.push(signature);
    const max = this.opts.maxSeenSignatures ?? DEFAULT_MAX_SEEN_SIGNATURES;
    if (this.seenOrder.length > max) {
      const oldest = this.seenOrder.shift();
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return true;
  }
}

interface LogsNotification {
  method: "logsNotification";
  params: {
    result: {
      value: { signature: string; err: unknown | null; logs: string[] };
    };
  };
}

function isLogsNotification(msg: unknown): msg is LogsNotification {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m.method !== "logsNotification") return false;
  const params = m.params as Record<string, unknown> | undefined;
  const result = params?.result as Record<string, unknown> | undefined;
  const value = result?.value as Record<string, unknown> | undefined;
  return typeof value?.signature === "string" && Array.isArray(value.logs);
}

// Derives the websocket URL from the RPC URL's scheme (http→ws, https→wss),
// which matches the public mainnet-beta endpoint. Override with a dedicated
// websocket URL (e.g. SOLANA_WS_URL) if the RPC provider uses a different host.
export function deriveWsUrl(rpcUrl: string): string {
  const url = new URL(rpcUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

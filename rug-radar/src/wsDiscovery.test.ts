import test from "node:test";
import assert from "node:assert/strict";
import { LaunchWatcher, deriveWsUrl } from "./wsDiscovery.js";
import type { WebSocketLike } from "./wsDiscovery.js";
import type { ParsedTransaction } from "./rpc.js";

const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

const CREATE_V2_LOGS = [
  "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]",
  "Program log: Instruction: CreateV2",
  "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success",
];

const BUY_ONLY_LOGS = [
  "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]",
  "Program log: Instruction: BuyV2",
  "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success",
];

class FakeWebSocket implements WebSocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.onclose?.({ code: 1000 });
  }

  emitOpen(): void {
    this.onopen?.();
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({ data });
  }

  emitDrop(): void {
    this.onclose?.({ code: 1006 });
  }
}

function subscribeAckFor(ws: FakeWebSocket): unknown {
  const req = JSON.parse(ws.sent[0]);
  return { jsonrpc: "2.0", id: req.id, result: 12345 };
}

function logsNotification(signature: string, logs: string[], err: unknown | null = null) {
  return {
    jsonrpc: "2.0",
    method: "logsNotification",
    params: { subscription: 12345, result: { context: { slot: 1 }, value: { signature, err, logs } } },
  };
}

function fakeRpc(getTransactionImpl: (signature: string) => Promise<ParsedTransaction | null>) {
  return { getTransaction: getTransactionImpl };
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function fixtureTx(signature: string) {
  return {
    slot: 1,
    blockTime: 1_700_000_000,
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [],
        instructions: [
          {
            programId: PUMP_FUN_PROGRAM_ID,
            accounts: [
              "Mint1111111111111111111111111111111111111",
              "Acc2",
              "BondingCurve111111111111111111111111111111",
              "Acc4",
              "Acc5",
              "Acc6",
              "Acc7",
              "Deployer11111111111111111111111111111111111",
            ],
            // base58Encode([24,30,200,40,5,28,7,119]) — the "create" discriminator, no args
            data: "52zoRTfx1nE",
          },
        ],
      },
    },
    meta: { err: null, fee: 5000, preBalances: [], postBalances: [] },
  };
}

test("subscribes with the pump.fun mentions filter on open", () => {
  const sockets: FakeWebSocket[] = [];
  const watcher = new LaunchWatcher("wss://fake", fakeRpc(async () => null), {
    onLaunch: () => {},
    wsFactory: (url) => {
      const ws = new FakeWebSocket();
      sockets.push(ws);
      return ws;
    },
  });

  watcher.start();
  sockets[0].emitOpen();

  const req = JSON.parse(sockets[0].sent[0]);
  assert.equal(req.method, "logsSubscribe");
  assert.deepEqual(req.params[0], { mentions: [PUMP_FUN_PROGRAM_ID] });
  watcher.stop();
});

test("resolves a create notification into onLaunch", async () => {
  const sockets: FakeWebSocket[] = [];
  const launches: unknown[] = [];
  const watcher = new LaunchWatcher(
    "wss://fake",
    fakeRpc(async (sig) => fixtureTx(sig)),
    {
      onLaunch: (l) => launches.push(l),
      wsFactory: (url) => {
        const ws = new FakeWebSocket();
        sockets.push(ws);
        return ws;
      },
    },
  );

  watcher.start();
  const ws = sockets[0];
  ws.emitOpen();
  ws.emitMessage(JSON.stringify(subscribeAckFor(ws)));
  ws.emitMessage(JSON.stringify(logsNotification("sig-create-1", CREATE_V2_LOGS)));

  await flushMicrotasks();

  assert.equal(launches.length, 1);
  assert.deepEqual(launches[0], {
    mint: "Mint1111111111111111111111111111111111111",
    deployer: "Deployer11111111111111111111111111111111111",
    bondingCurve: "BondingCurve111111111111111111111111111111",
    createdAt: 1_700_000_000,
    signature: "sig-create-1",
  });
  watcher.stop();
});

test("ignores non-create notifications without calling getTransaction", async () => {
  const sockets: FakeWebSocket[] = [];
  const launches: unknown[] = [];
  let getTransactionCalls = 0;
  const watcher = new LaunchWatcher(
    "wss://fake",
    fakeRpc(async (sig) => {
      getTransactionCalls++;
      return fixtureTx(sig);
    }),
    {
      onLaunch: (l) => launches.push(l),
      wsFactory: (url) => {
        const ws = new FakeWebSocket();
        sockets.push(ws);
        return ws;
      },
    },
  );

  watcher.start();
  const ws = sockets[0];
  ws.emitOpen();
  ws.emitMessage(JSON.stringify(logsNotification("sig-buy-1", BUY_ONLY_LOGS)));

  await flushMicrotasks();

  assert.equal(launches.length, 0);
  assert.equal(getTransactionCalls, 0);
  watcher.stop();
});

test("skips a notification with a transaction-level error", async () => {
  const sockets: FakeWebSocket[] = [];
  const launches: unknown[] = [];
  const watcher = new LaunchWatcher("wss://fake", fakeRpc(async (sig) => fixtureTx(sig)), {
    onLaunch: (l) => launches.push(l),
    wsFactory: (url) => {
      const ws = new FakeWebSocket();
      sockets.push(ws);
      return ws;
    },
  });

  watcher.start();
  const ws = sockets[0];
  ws.emitOpen();
  ws.emitMessage(JSON.stringify(logsNotification("sig-failed", CREATE_V2_LOGS, { InstructionError: [0, {}] })));

  await flushMicrotasks();

  assert.equal(launches.length, 0);
  watcher.stop();
});

test("deduplicates a signature seen twice (e.g. redelivered after resubscribe)", async () => {
  const sockets: FakeWebSocket[] = [];
  const launches: unknown[] = [];
  let getTransactionCalls = 0;
  const watcher = new LaunchWatcher(
    "wss://fake",
    fakeRpc(async (sig) => {
      getTransactionCalls++;
      return fixtureTx(sig);
    }),
    {
      onLaunch: (l) => launches.push(l),
      wsFactory: (url) => {
        const ws = new FakeWebSocket();
        sockets.push(ws);
        return ws;
      },
    },
  );

  watcher.start();
  const ws = sockets[0];
  ws.emitOpen();
  ws.emitMessage(JSON.stringify(logsNotification("sig-dup", CREATE_V2_LOGS)));
  ws.emitMessage(JSON.stringify(logsNotification("sig-dup", CREATE_V2_LOGS)));

  await flushMicrotasks();

  assert.equal(launches.length, 1);
  assert.equal(getTransactionCalls, 1);
  watcher.stop();
});

test("retries a transiently not-found transaction (RPC replication lag) before resolving", async () => {
  const sockets: FakeWebSocket[] = [];
  const launches: unknown[] = [];
  const sleeps: number[] = [];
  let getTransactionCalls = 0;
  const watcher = new LaunchWatcher(
    "wss://fake",
    fakeRpc(async (sig) => {
      getTransactionCalls++;
      return getTransactionCalls < 3 ? null : fixtureTx(sig);
    }),
    {
      onLaunch: (l) => launches.push(l),
      resolveBaseDelayMs: 25,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      wsFactory: (url) => {
        const ws = new FakeWebSocket();
        sockets.push(ws);
        return ws;
      },
    },
  );

  watcher.start();
  const ws = sockets[0];
  ws.emitOpen();
  ws.emitMessage(JSON.stringify(logsNotification("sig-lagged", CREATE_V2_LOGS)));

  await flushMicrotasks();

  assert.equal(getTransactionCalls, 3);
  assert.deepEqual(sleeps, [25, 50]); // exponential backoff: 25*2^0, 25*2^1
  assert.equal(launches.length, 1);
  watcher.stop();
});

test("reconnects and resubscribes after the connection drops", async () => {
  const sockets: FakeWebSocket[] = [];
  const sleeps: number[] = [];
  const watcher = new LaunchWatcher("wss://fake", fakeRpc(async () => null), {
    onLaunch: () => {},
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    reconnectBaseDelayMs: 100,
    wsFactory: (url) => {
      const ws = new FakeWebSocket();
      sockets.push(ws);
      return ws;
    },
  });

  watcher.start();
  sockets[0].emitOpen();
  sockets[0].emitDrop();
  await flushMicrotasks();

  assert.equal(sleeps.length, 1);
  assert.equal(sleeps[0], 100);
  assert.equal(sockets.length, 2, "should have opened a second socket after the drop");

  sockets[1].emitOpen();
  const req = JSON.parse(sockets[1].sent[0]);
  assert.equal(req.method, "logsSubscribe");
  watcher.stop();
});

test("does not reconnect after stop() is called", async () => {
  const sockets: FakeWebSocket[] = [];
  const watcher = new LaunchWatcher("wss://fake", fakeRpc(async () => null), {
    onLaunch: () => {},
    wsFactory: (url) => {
      const ws = new FakeWebSocket();
      sockets.push(ws);
      return ws;
    },
  });

  watcher.start();
  sockets[0].emitOpen();
  watcher.stop();

  assert.equal(sockets[0].closed, true);
  assert.equal(sockets.length, 1, "stop() should not trigger a reconnect");
});

test("deriveWsUrl swaps https for wss and http for ws", () => {
  assert.equal(deriveWsUrl("https://api.mainnet-beta.solana.com"), "wss://api.mainnet-beta.solana.com/");
  assert.equal(deriveWsUrl("http://localhost:8899"), "ws://localhost:8899/");
});

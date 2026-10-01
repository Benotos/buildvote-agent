// Scratch probe (not committed): connect to the public Solana websocket RPC,
// subscribe to pump.fun program logs, and print raw log lines for any
// transaction whose logs look like a "create" so we can see the exact text
// Anchor emits before writing a parser against it. Deleted before the
// session ends.
const WS_URL = "wss://api.mainnet-beta.solana.com";
const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

const ws = new WebSocket(WS_URL);

let seen = 0;
const seenSigs = new Set();

ws.onopen = () => {
  console.log("connected, subscribing...");
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "logsSubscribe",
      params: [{ mentions: [PUMP_FUN_PROGRAM_ID] }, { commitment: "confirmed" }],
    }),
  );
};

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data.toString());
  if (msg.id === 1) {
    console.log("subscribed, id:", msg.result);
    return;
  }
  if (msg.method !== "logsNotification") return;
  const { signature, err, logs } = msg.params.result.value;
  if (err) return;
  if (seenSigs.has(signature)) return;
  seenSigs.add(signature);

  const text = logs.join("\n");
  if (/instruction:\s*create/i.test(text)) {
    seen++;
    console.log("=== CREATE-LIKE", signature, "===");
    console.log(text);
    console.log();
    if (seen >= 3) {
      console.log("got 3, closing");
      ws.close();
      process.exit(0);
    }
  }
};

ws.onerror = (e) => console.error("ws error", e.message ?? e);
ws.onclose = (e) => console.log("closed", e.code, e.reason);

setTimeout(() => {
  console.log(`timeout, saw ${seenSigs.size} total log notifications, 0 create-like`);
  process.exit(0);
}, 45000);

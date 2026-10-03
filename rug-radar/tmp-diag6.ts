import { SolanaRpcClient } from "./src/rpc.js";
import { PUMP_FUN_PROGRAM_ID } from "./src/pumpfun.js";
import { detectCreateInstruction } from "./src/wsLogParser.js";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const rpc = new SolanaRpcClient(RPC_URL, fetch, { maxConcurrent: 1, maxRetries: 0 });

const ws = new WebSocket("wss://api.mainnet-beta.solana.com");
let targetSig: string | null = null;
let detectedAt = 0;

ws.onopen = () => {
  ws.send(JSON.stringify({jsonrpc:"2.0", id:1, method:"logsSubscribe", params:[{mentions:[PUMP_FUN_PROGRAM_ID]}, {commitment:"confirmed"}]}));
};
ws.onmessage = (e) => {
  if (targetSig) return; // only track the first one found
  const msg = JSON.parse(String(e.data));
  if (msg.method !== "logsNotification") return;
  const { signature, err, logs } = msg.params.result.value;
  if (err) return;
  const variant = detectCreateInstruction(PUMP_FUN_PROGRAM_ID, logs);
  if (!variant) return;
  targetSig = signature;
  detectedAt = performance.now();
  console.log("detected", signature, "at t=0");
  poll();
};

async function poll() {
  for (let i = 0; i < 15; i++) {
    const elapsed = Math.round(performance.now() - detectedAt);
    try {
      const tx = await rpc.getTransaction(targetSig!);
      if (tx) {
        console.log(`RESOLVED at t=${elapsed}ms (attempt ${i + 1})`);
        process.exit(0);
      }
      console.log(`[t=${elapsed}ms] still null (attempt ${i + 1})`);
    } catch (err) {
      console.log(`[t=${elapsed}ms] error: ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("gave up after 15 attempts");
  process.exit(1);
}

setTimeout(() => { if (!targetSig) { console.log("no create detected in 30s"); process.exit(1); } }, 30000);

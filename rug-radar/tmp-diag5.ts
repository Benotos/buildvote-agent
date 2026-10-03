import { SolanaRpcClient } from "./src/rpc.js";
import { PUMP_FUN_PROGRAM_ID } from "./src/pumpfun.js";
import { detectCreateInstruction } from "./src/wsLogParser.js";
import { resolveLaunchFromSignature } from "./src/discovery.js";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const rpc = new SolanaRpcClient(RPC_URL, fetch, { maxConcurrent: 2 });

const ws = new WebSocket("wss://api.mainnet-beta.solana.com");
let total = 0, detected = 0, resolved = 0, failed = 0;
ws.onopen = () => {
  console.log("open, subscribing");
  ws.send(JSON.stringify({jsonrpc:"2.0", id:1, method:"logsSubscribe", params:[{mentions:[PUMP_FUN_PROGRAM_ID]}, {commitment:"confirmed"}]}));
};
ws.onmessage = (e) => {
  const msg = JSON.parse(String(e.data));
  if (msg.method !== "logsNotification") return;
  total++;
  const { signature, err, logs } = msg.params.result.value;
  if (err) return;
  const variant = detectCreateInstruction(PUMP_FUN_PROGRAM_ID, logs);
  if (!variant) return;
  detected++;
  resolveLaunchFromSignature(rpc, signature).then((launch) => {
    if (launch) { resolved++; console.log("RESOLVED", launch.mint); }
    else { failed++; console.log("RESOLVE-NULL (exhausted retries)", signature); }
  }).catch((err2) => { failed++; console.log("RESOLVE-ERR", signature, err2); });
};
ws.onerror = (e) => console.log("ERROR", e.message || e);
setTimeout(() => { console.log(`\nSUMMARY total=${total} detected=${detected} resolved=${resolved} failed=${failed}`); process.exit(0); }, 35000);

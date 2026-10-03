import { PUMP_FUN_PROGRAM_ID } from "./src/pumpfun.js";
import { detectCreateInstruction } from "./src/wsLogParser.js";
import { resolveLaunchFromSignature } from "./src/discovery.js";
import { SolanaRpcClient } from "./src/rpc.js";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const rpc = new SolanaRpcClient(RPC_URL, fetch, { maxConcurrent: 2 });

const ws = new WebSocket("wss://api.mainnet-beta.solana.com");
let total = 0, detected = 0, resolved = 0;
ws.onopen = () => {
  console.log("open, subscribing to", PUMP_FUN_PROGRAM_ID);
  ws.send(JSON.stringify({jsonrpc:"2.0", id:1, method:"logsSubscribe", params:[{mentions:[PUMP_FUN_PROGRAM_ID]}, {commitment:"confirmed"}]}));
};
ws.onmessage = (e) => {
  const msg = JSON.parse(String(e.data));
  if (msg.method !== "logsNotification") { console.log("other", JSON.stringify(msg).slice(0,200)); return; }
  total++;
  const { signature, err, logs } = msg.params.result.value;
  if (err) return;
  const variant = detectCreateInstruction(PUMP_FUN_PROGRAM_ID, logs);
  if (!variant) return;
  detected++;
  console.log("DETECTED", variant, signature);
  resolveLaunchFromSignature(rpc, signature).then((launch) => {
    if (launch) { resolved++; console.log("RESOLVED", JSON.stringify(launch)); }
    else console.log("RESOLVE-NULL", signature);
  }).catch((err2) => console.log("RESOLVE-ERR", signature, err2));
};
ws.onerror = (e) => console.log("ERROR", e.message || e);
ws.onclose = (e) => console.log("CLOSE", e.code);
setTimeout(() => { console.log(`total=${total} detected=${detected} resolved=${resolved}`); process.exit(0); }, 30000);

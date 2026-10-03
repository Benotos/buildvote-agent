import { SolanaRpcClient } from "./src/rpc.js";
import { PUMP_FUN_PROGRAM_ID, decodeCreateInstruction } from "./src/pumpfun.js";
import { base58Decode } from "./src/base58.js";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const rpc = new SolanaRpcClient(RPC_URL, fetch, { maxConcurrent: 2 });

const sig = process.argv[2];
const tx = await rpc.getTransaction(sig);
if (!tx) { console.log("no tx"); process.exit(1); }
for (const ix of tx.transaction.message.instructions ?? []) {
  if (ix.programId !== PUMP_FUN_PROGRAM_ID) continue;
  console.log("--- pump.fun top-level ix ---");
  console.log("has data:", "data" in ix);
  if ("data" in ix) {
    const data = (ix as any).data;
    console.log("raw data (base58):", data);
    const bytes = base58Decode(data);
    console.log("decoded byte length:", bytes.length);
    console.log("first 8 bytes (discriminator):", Array.from(bytes.slice(0,8)));
    console.log("accounts count:", (ix as any).accounts?.length);
    console.log("accounts:", (ix as any).accounts);
    const decoded = decodeCreateInstruction(data, (ix as any).accounts);
    console.log("decodeCreateInstruction result:", decoded);
  }
}

import { SolanaRpcClient } from "./src/rpc.js";
import { PUMP_FUN_PROGRAM_ID } from "./src/pumpfun.js";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const rpc = new SolanaRpcClient(RPC_URL, fetch, { maxConcurrent: 2 });

const sig = process.argv[2];
const tx = await rpc.getTransaction(sig);
if (!tx) { console.log("no tx"); process.exit(1); }
console.log("top-level instructions:");
for (const ix of tx.transaction.message.instructions ?? []) {
  console.log(" programId:", ix.programId, "hasData:", "data" in ix);
}
console.log("\ninnerInstructions:");
for (const inner of tx.meta?.innerInstructions ?? []) {
  console.log(" index", inner.index, "instructions:");
  for (const ix of inner.instructions ?? []) {
    console.log("   programId:", ix.programId, "hasData:", "data" in ix, "dataLen:", (ix as any).data?.length);
  }
}
console.log("\nmatches pump.fun program at top level:", (tx.transaction.message.instructions ?? []).some((ix: any) => ix.programId === PUMP_FUN_PROGRAM_ID));
console.log("matches pump.fun program in inner:", (tx.meta?.innerInstructions ?? []).some((inner: any) => inner.instructions.some((ix: any) => ix.programId === PUMP_FUN_PROGRAM_ID)));

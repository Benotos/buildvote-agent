import { SolanaRpcClient } from "./src/rpc.js";
import { resolveLaunchFromSignature } from "./src/discovery.js";
import { safeGetTransaction } from "./src/rpc.js";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const rpc = new SolanaRpcClient(RPC_URL, fetch, { maxConcurrent: 2 });

const sig = process.argv[2];
const tx = await safeGetTransaction(rpc, sig);
console.log("tx is null?", tx === null);
if (tx) {
  console.log("blockTime:", tx.blockTime);
  console.log("num top-level instructions:", tx.transaction.message.instructions?.length);
}
const launch = await resolveLaunchFromSignature(rpc, sig);
console.log("resolveLaunchFromSignature result:", launch);

import { SolanaRpcClient } from "./src/rpc.js";
import { findNewLaunches } from "./src/discovery.js";
import { scoreLaunch } from "./src/pipeline.js";
import { loadConfig } from "./src/config.js";

const config = loadConfig();
const rpc = new SolanaRpcClient(config.rpcUrl);

const seed = await findNewLaunches(rpc, null, { limit: 5 });
console.log("seeded cursor:", seed.newestSignature);

const next = await findNewLaunches(rpc, seed.newestSignature, { limit: 5 });
console.log("found launches:", next.launches.length);
console.log(next.launches);

if (next.launches.length > 0) {
  const score = await scoreLaunch(rpc, next.launches[0]);
  console.log(JSON.stringify(score, null, 2));
}

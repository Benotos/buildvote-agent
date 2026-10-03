import { SolanaRpcClient } from "./src/rpc.js";
import { LaunchWatcher, deriveWsUrl } from "./src/wsDiscovery.js";
import { fetchBundledBuysInput } from "./src/data/bundledBuys.js";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const rpc = new SolanaRpcClient(RPC_URL, fetch, { maxConcurrent: 2, maxRetries: 6, baseDelayMs: 500 });

const watcher = new LaunchWatcher(deriveWsUrl(RPC_URL), rpc, {
  onLaunch: (launch) => {
    console.log("LAUNCH", launch.mint, launch.bondingCurve, launch.createdAt);
    captured.push(launch);
  },
  onError: (err) => console.error("watcher error", err),
});

const captured: { mint: string; bondingCurve: string; createdAt: number }[] = [];

console.log("starting watcher at", new Date().toISOString());
watcher.start();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Let a handful of launches accumulate, then give them time to pick up
  // early buys before checking the funding-source lookback.
  for (let i = 0; i < 4; i++) {
    await sleep(10_000);
    console.log(`[${(i + 1) * 10}s] captured so far: ${captured.length}`);
  }
  watcher.stop();
  console.log(`Captured ${captured.length} launches. Waiting for early-buy activity...`);
  await sleep(90_000);

  for (const launch of captured.slice(0, 3)) {
    console.log(`\n=== mint ${launch.mint} ===`);
    const defaultBuys = await fetchBundledBuysInput(rpc, launch.mint, launch.bondingCurve, launch.createdAt);
    const wideBuys = await fetchBundledBuysInput(rpc, launch.mint, launch.bondingCurve, launch.createdAt, {
      signatureLimit: 1000,
    });
    console.log("default (limit 50):", JSON.stringify(defaultBuys, null, 2));
    console.log("wide (limit 1000):", JSON.stringify(wideBuys, null, 2));
    const defaultUnknown = defaultBuys.filter((b) => b.fundedBy === null).length;
    const wideUnknown = wideBuys.filter((b) => b.fundedBy === null).length;
    console.log(`unknown funding source: default=${defaultUnknown}/${defaultBuys.length}, wide=${wideUnknown}/${wideBuys.length}`);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

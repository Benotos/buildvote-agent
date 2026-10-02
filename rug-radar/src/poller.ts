// One poll cycle: find launches newer than the last-seen cursor, score each,
// and add them to the live feed. The caller (server.ts) decides how often to
// call this (setInterval) — kept separate so a single cycle is testable
// without real timers.

import { findNewLaunches } from "./discovery.js";
import { scoreLaunch, type PipelineRpc } from "./pipeline.js";
import type { LiveFeed } from "./feed.js";
import type { SolanaRpcClient } from "./rpc.js";
import type { DeployerIndex } from "./deployerIndex.js";

export interface PollState {
  sinceBlockTime: number | null;
}

type PollerRpc = PipelineRpc & Pick<SolanaRpcClient, "getSignaturesForAddress" | "getTransaction">;

export async function pollOnce(
  rpc: PollerRpc,
  feed: LiveFeed,
  state: PollState,
  deployerIndex?: DeployerIndex,
): Promise<void> {
  const { launches, newestBlockTime } = await findNewLaunches(rpc, state.sinceBlockTime);
  state.sinceBlockTime = newestBlockTime;

  for (const launch of launches) {
    try {
      feed.add(await scoreLaunch(rpc, launch, deployerIndex));
    } catch (err) {
      console.error(`failed to score launch ${launch.mint}:`, err instanceof Error ? err.message : err);
    }
  }
}

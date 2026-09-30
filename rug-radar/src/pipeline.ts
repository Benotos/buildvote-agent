// Turns one discovered launch into a full LaunchScore: fetches each signal's
// input from the public RPC, scores it, and combines the results. A signal
// whose data isn't available yet (e.g. too early for holder data to settle)
// is dropped rather than failing the whole launch.

import { fetchDeployerHistoryInput } from "./data/deployerHistory.js";
import { fetchBundledBuysInput } from "./data/bundledBuys.js";
import { fetchHolderConcentrationInput } from "./data/holderConcentration.js";
import { fetchLiquidityInput } from "./data/liquidity.js";
import { scoreDeployerHistory } from "./signals/deployerHistory.js";
import { scoreBundledBuys } from "./signals/bundledBuys.js";
import { scoreHolderConcentration } from "./signals/holderConcentration.js";
import { scoreLiquidity } from "./signals/liquidity.js";
import { combineSignals } from "./scorer.js";
import { KNOWN_PROGRAM_ACCOUNT_ADDRESSES } from "./knownAccounts.js";
import type { SolanaRpcClient } from "./rpc.js";
import type { DiscoveredLaunch } from "./discovery.js";
import type { LaunchScore, SignalResult } from "./types.js";

export type PipelineRpc = Pick<
  SolanaRpcClient,
  | "getTokenSupply"
  | "getTokenLargestAccounts"
  | "getAccountInfo"
  | "getSignaturesForAddress"
  | "getTransaction"
>;

export async function scoreLaunch(
  rpc: PipelineRpc,
  launch: DiscoveredLaunch,
): Promise<LaunchScore> {
  const results = await Promise.all([
    safeSignal("deployer-history", async () => {
      const priorLaunches = await fetchDeployerHistoryInput(rpc, launch.deployer, launch.mint);
      return scoreDeployerHistory({ deployer: launch.deployer, priorLaunches });
    }),
    safeSignal("bundled-buys", async () => {
      const earlyBuys = await fetchBundledBuysInput(
        rpc,
        launch.mint,
        launch.bondingCurve,
        launch.createdAt,
      );
      return scoreBundledBuys({ earlyBuys });
    }),
    safeSignal("holder-concentration", async () => {
      const input = await fetchHolderConcentrationInput(rpc, launch.mint, [
        launch.bondingCurve,
        ...KNOWN_PROGRAM_ACCOUNT_ADDRESSES,
      ]);
      return scoreHolderConcentration(input);
    }),
    safeSignal("liquidity", async () => {
      const input = await fetchLiquidityInput(rpc, launch.bondingCurve);
      return scoreLiquidity(input);
    }),
  ]);

  const signals = results.filter((s): s is SignalResult => s !== null);
  return combineSignals(launch.mint, signals);
}

async function safeSignal(
  name: string,
  run: () => Promise<SignalResult>,
): Promise<SignalResult | null> {
  try {
    return await run();
  } catch (err) {
    console.error(`signal ${name} failed for this launch:`, err instanceof Error ? err.message : err);
    return null;
  }
}

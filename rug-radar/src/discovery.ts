// Discovers new pump.fun launches by polling the program account's own
// signature history for "create"/"create_v2" instructions. No websockets or
// private endpoints — just repeated calls to the same public
// getSignaturesForAddress/getTransaction methods the other data/* modules use.

import { decodeCreateInstruction, PUMP_FUN_PROGRAM_ID } from "./pumpfun.js";
import { safeGetTransaction } from "./rpc.js";
import type { ParsedTransaction, SolanaRpcClient } from "./rpc.js";

export interface DiscoveredLaunch {
  mint: string;
  deployer: string;
  bondingCurve: string;
  createdAt: number; // unix seconds, from the transaction's blockTime
  signature: string;
}

type DiscoveryFetcher = Pick<SolanaRpcClient, "getSignaturesForAddress" | "getTransaction">;

export interface FindNewLaunchesOptions {
  // How many of the program's most recent signatures to scan per poll.
  // KNOWN LIMITATION (confirmed live, session 10): the pump.fun program ID
  // sees roughly 500 transactions/second across *all* instruction types
  // (buy/sell/create/migrate combined) — 1000 signatures from
  // getSignaturesForAddress span only ~2 seconds of real traffic. A 15s poll
  // with this default therefore only samples a sliver of each interval and
  // will miss most create instructions, not just "bursts". Raising this
  // doesn't fix coverage (the firehose is way bigger than any sane limit)
  // and makes the 429 problem worse (one getTransaction call per signature
  // against a public, rate-limited RPC). A real fix needs a different
  // discovery mechanism — e.g. a websocket logsSubscribe with a `mentions`
  // filter on the program, parsing "Instruction: Create" out of the log
  // lines that arrive for free with the subscription, instead of polling
  // signatures and fetching each transaction — not attempted yet.
  limit?: number;
}

const DEFAULT_LIMIT = 50;

export interface FindNewLaunchesResult {
  launches: DiscoveredLaunch[];
  // Pass this back in as `sinceBlockTime` on the next poll.
  newestBlockTime: number | null;
}

// Finds launches newer than `sinceBlockTime` (exclusive), returned oldest-first.
// Pass `sinceBlockTime: null` on the very first poll — it seeds the watermark
// from whatever's currently at the head of the program's history rather than
// treating that entire initial window as "new" launches to score.
//
// Deliberately timestamp-based rather than using getSignaturesForAddress's
// own `until` signature cursor: against the public multi-node RPC cluster, a
// signature seen by one node can be unknown to whichever node serves the next
// poll, and that node errors on an unrecognized `until` cursor instead of
// falling back gracefully (observed against real mainnet-beta, not just a
// documented edge case). Filtering client-side by blockTime sidesteps that.
export async function findNewLaunches(
  rpc: DiscoveryFetcher,
  sinceBlockTime: number | null,
  options: FindNewLaunchesOptions = {},
): Promise<FindNewLaunchesResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const signatures = await rpc.getSignaturesForAddress(PUMP_FUN_PROGRAM_ID, limit);

  const newestBlockTime = signatures.find((s) => s.blockTime !== null)?.blockTime ?? sinceBlockTime;

  if (sinceBlockTime === null) {
    return { launches: [], newestBlockTime };
  }

  const launches: DiscoveredLaunch[] = [];
  // getSignaturesForAddress returns newest-first; scan oldest-first so the
  // feed fills in launch order.
  for (const sig of [...signatures].reverse()) {
    if (sig.err || sig.blockTime === null || sig.blockTime <= sinceBlockTime) continue;

    const tx = await safeGetTransaction(rpc, sig.signature);
    if (!tx) continue;

    const created = findCreateInstruction(tx);
    if (!created) continue;

    launches.push({ ...created, createdAt: sig.blockTime, signature: sig.signature });
  }

  return { launches, newestBlockTime };
}

function findCreateInstruction(
  tx: ParsedTransaction,
): { mint: string; deployer: string; bondingCurve: string } | null {
  const instructions = tx.transaction.message.instructions ?? [];
  for (const ix of instructions) {
    if (ix.programId !== PUMP_FUN_PROGRAM_ID || !("data" in ix)) continue;
    const decoded = decodeCreateInstruction(ix.data, ix.accounts);
    if (decoded) {
      return { mint: decoded.mint, deployer: decoded.user, bondingCurve: decoded.bondingCurve };
    }
  }
  return null;
}

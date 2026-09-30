// Discovers new pump.fun launches by polling the program account's own
// signature history for "create"/"create_v2" instructions. No websockets or
// private endpoints — just repeated calls to the same public
// getSignaturesForAddress/getTransaction methods the other data/* modules use.

import { decodeCreateInstruction, PUMP_FUN_PROGRAM_ID } from "./pumpfun.js";
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
  // How many of the program's most recent signatures to scan per poll. A
  // burst of more than this many launches between polls will be under-counted
  // rather than scanned exhaustively.
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

    let tx: ParsedTransaction | null;
    try {
      tx = await rpc.getTransaction(sig.signature);
    } catch (err) {
      // The public RPC cluster is multiple nodes behind a load balancer; a
      // signature returned by one node's getSignaturesForAddress can briefly
      // 404 on getTransaction against another. Skip it rather than failing
      // the whole poll — it'll be picked up as "prior history" on any
      // signal that later scans this address's signatures anyway.
      console.error(
        `getTransaction failed for ${sig.signature}:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }
    if (!tx) continue;

    const created = findCreateInstruction(tx);
    if (!created) continue;

    launches.push({ ...created, createdAt: sig.blockTime, signature: sig.signature });
  }

  return { launches, newestSignature };
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

import { decodeBondingCurve, decodeCreateInstruction, PUMP_FUN_PROGRAM_ID } from "../pumpfun.js";
import type { ParsedTransaction, SolanaRpcClient } from "../rpc.js";
import type { PriorLaunch } from "../signals/deployerHistory.js";

type HistoryFetcher = Pick<
  SolanaRpcClient,
  "getSignaturesForAddress" | "getTransaction" | "getAccountInfo"
>;

export interface FetchDeployerHistoryOptions {
  // How many of the deployer's most recent signatures to scan for past
  // pump.fun "create" instructions. A prolific deployer with more history
  // than this limit will be under-counted rather than scanned exhaustively.
  signatureLimit?: number;
}

const DEFAULT_SIGNATURE_LIMIT = 100;

export async function fetchDeployerHistoryInput(
  rpc: HistoryFetcher,
  deployer: string,
  currentMint: string,
  options: FetchDeployerHistoryOptions = {},
): Promise<PriorLaunch[]> {
  const signatureLimit = options.signatureLimit ?? DEFAULT_SIGNATURE_LIMIT;
  const signatures = await rpc.getSignaturesForAddress(deployer, signatureLimit);

  const priorLaunches: PriorLaunch[] = [];
  const seenMints = new Set<string>([currentMint]);

  for (const sig of signatures) {
    if (sig.err) continue;
    const tx = await rpc.getTransaction(sig.signature);
    if (!tx) continue;

    const created = findCreatedMint(tx, deployer);
    if (!created || seenMints.has(created.mint)) continue;
    seenMints.add(created.mint);

    const migrated = await wasMigrated(rpc, created.bondingCurve);
    priorLaunches.push({ mint: created.mint, migrated });
  }

  return priorLaunches;
}

// Looks for a pump.fun create/create_v2 instruction in this transaction that
// this deployer signed as the "user" account, and returns the mint + bonding
// curve it created.
function findCreatedMint(
  tx: ParsedTransaction,
  deployer: string,
): { mint: string; bondingCurve: string } | null {
  const instructions = tx.transaction.message.instructions ?? [];
  for (const ix of instructions) {
    if (ix.programId !== PUMP_FUN_PROGRAM_ID || !("data" in ix)) continue;
    const decoded = decodeCreateInstruction(ix.data, ix.accounts);
    if (decoded && decoded.user === deployer) {
      return { mint: decoded.mint, bondingCurve: decoded.bondingCurve };
    }
  }
  return null;
}

async function wasMigrated(rpc: HistoryFetcher, bondingCurveAddress: string): Promise<boolean> {
  const account = await rpc.getAccountInfo(bondingCurveAddress);
  if (!account || !Array.isArray(account.data)) return false;
  try {
    return decodeBondingCurve(account.data[0]).complete;
  } catch {
    // Account exists but isn't a readable bonding curve (e.g. already closed) —
    // treat as "not migrated" rather than failing the whole lookup.
    return false;
  }
}

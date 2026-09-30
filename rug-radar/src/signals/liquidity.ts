import type { SignalResult } from "../types.js";

export interface LiquidityInput {
  // Whether the bonding curve has graduated (liquidity migrated to an AMM).
  complete: boolean;
  // Real (non-virtual) SOL reserves backing the curve, in lamports.
  realSolReserves: bigint;
}

const LAMPORTS_PER_SOL = 1_000_000_000n;
const LOW_LIQUIDITY_SOL = 5n;
const MODERATE_LIQUIDITY_SOL = 15n;

function solLabel(lamports: bigint): string {
  return (Number(lamports) / Number(LAMPORTS_PER_SOL)).toFixed(2);
}

export function scoreLiquidity(input: LiquidityInput): SignalResult {
  const label = solLabel(input.realSolReserves);

  if (input.complete) {
    return {
      name: "liquidity",
      score: 10,
      reasons: [`bonding curve complete, liquidity migrated to an AMM (last real reserves ${label} SOL)`],
    };
  }

  if (input.realSolReserves <= LOW_LIQUIDITY_SOL * LAMPORTS_PER_SOL) {
    return {
      name: "liquidity",
      score: 80,
      reasons: [`still on bonding curve with thin real liquidity (${label} SOL)`],
    };
  }

  if (input.realSolReserves <= MODERATE_LIQUIDITY_SOL * LAMPORTS_PER_SOL) {
    return {
      name: "liquidity",
      score: 45,
      reasons: [`still on bonding curve with moderate real liquidity (${label} SOL)`],
    };
  }

  return {
    name: "liquidity",
    score: 20,
    reasons: [`still on bonding curve with deep real liquidity (${label} SOL), approaching graduation`],
  };
}

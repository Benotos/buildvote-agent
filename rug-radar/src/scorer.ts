// Combines individual signal results into one overall risk score.
// Weighted average of each signal's 0-100 score, rounded; reasons are
// flattened in signal order so the number always comes with its "why".

import type { LaunchScore, SignalResult } from "./types.js";

// Signals not listed default to weight 1. Liquidity and holder concentration
// are the most direct rug-pull indicators, so they count for more than
// wallet-behavior signals like bundled buys.
const SIGNAL_WEIGHTS: Record<string, number> = {
  liquidity: 2,
  "holder-concentration": 2,
  "bundled-buys": 1,
  "deployer-history": 1,
};

export function combineSignals(mint: string, signals: SignalResult[]): LaunchScore {
  if (signals.length === 0) {
    return { mint, score: 0, signals: [] };
  }

  const totalWeight = signals.reduce((sum, s) => sum + (SIGNAL_WEIGHTS[s.name] ?? 1), 0);
  const weightedSum = signals.reduce(
    (sum, s) => sum + s.score * (SIGNAL_WEIGHTS[s.name] ?? 1),
    0,
  );

  return {
    mint,
    score: Math.round(weightedSum / totalWeight),
    signals,
  };
}

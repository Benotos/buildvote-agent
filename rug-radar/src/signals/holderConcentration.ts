import type { SignalResult } from "../types.js";

export interface HolderBalance {
  address: string;
  amount: bigint;
}

export interface HolderConcentrationInput {
  totalSupply: bigint;
  // Largest holder accounts for the mint (as returned by getTokenLargestAccounts).
  holders: HolderBalance[];
  // Addresses to leave out before ranking, e.g. the bonding curve account and
  // known program accounts (see knownAccounts.ts) — they aren't real holders.
  excludedAddresses: string[];
}

const HIGH_RISK_SHARE = 0.5;
const MODERATE_RISK_SHARE = 0.3;

export function scoreHolderConcentration(input: HolderConcentrationInput): SignalResult {
  if (input.totalSupply <= 0n) {
    return {
      name: "holder-concentration",
      score: 0,
      reasons: ["total supply is zero or unknown, cannot assess concentration"],
    };
  }

  const excluded = new Set(input.excludedAddresses);
  const eligible = input.holders
    .filter((h) => !excluded.has(h.address))
    .slice()
    .sort((a, b) => (a.amount < b.amount ? 1 : a.amount > b.amount ? -1 : 0));
  const top10 = eligible.slice(0, 10);

  const top10Total = top10.reduce((sum, h) => sum + h.amount, 0n);
  const share = Number(top10Total) / Number(input.totalSupply);
  const sharePct = (share * 100).toFixed(1);
  const label = `top ${top10.length} non-program holder${top10.length === 1 ? "" : "s"} hold ${sharePct}% of supply`;

  if (share >= HIGH_RISK_SHARE) {
    return { name: "holder-concentration", score: 90, reasons: [`${label} (>= 50%)`] };
  }
  if (share >= MODERATE_RISK_SHARE) {
    return { name: "holder-concentration", score: 55, reasons: [`${label} (30-50%)`] };
  }
  return {
    name: "holder-concentration",
    score: Math.round(share * 100),
    reasons: [label],
  };
}

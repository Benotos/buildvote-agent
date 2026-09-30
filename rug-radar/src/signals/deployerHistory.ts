import type { SignalResult } from "../types.js";

export interface PriorLaunch {
  mint: string;
  // Whether this earlier token's bonding curve completed (graduated to an AMM).
  // A curve that never completed and has gone quiet is the closest public,
  // on-chain proxy we have for "this token was abandoned".
  migrated: boolean;
}

export interface DeployerHistoryInput {
  deployer: string;
  // Tokens this wallet created before the current one.
  priorLaunches: PriorLaunch[];
}

// Below this many prior launches, a 0% or 100% migration rate isn't a
// reliable pattern yet — it's scored but capped low and flagged as thin data.
const MIN_HISTORY_FOR_PATTERN = 3;
const THIN_HISTORY_SCORE_CAP = 40;
const HIGH_RISK_DEAD_SHARE = 0.8;
const MODERATE_RISK_DEAD_SHARE = 0.5;

export function scoreDeployerHistory(input: DeployerHistoryInput): SignalResult {
  const total = input.priorLaunches.length;
  if (total === 0) {
    return {
      name: "deployer-history",
      score: 0,
      reasons: ["no prior tokens found from this deployer"],
    };
  }

  const migrated = input.priorLaunches.filter((t) => t.migrated).length;
  const dead = total - migrated;
  const deadShare = dead / total;
  const deadPct = (deadShare * 100).toFixed(0);
  const label = `${dead} of ${total} prior token${total === 1 ? "" : "s"} from this deployer never migrated (${deadPct}%)`;

  if (total < MIN_HISTORY_FOR_PATTERN) {
    const score = Math.min(THIN_HISTORY_SCORE_CAP, Math.round(deadShare * 100));
    return {
      name: "deployer-history",
      score,
      reasons: [`${label} — too few prior tokens to call it a pattern`],
    };
  }

  if (deadShare >= HIGH_RISK_DEAD_SHARE) {
    return { name: "deployer-history", score: 90, reasons: [`${label} (>= 80%)`] };
  }
  if (deadShare >= MODERATE_RISK_DEAD_SHARE) {
    return { name: "deployer-history", score: 55, reasons: [`${label} (50-80%)`] };
  }
  return {
    name: "deployer-history",
    score: Math.round(deadShare * 100),
    reasons: [label],
  };
}

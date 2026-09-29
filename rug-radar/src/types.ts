// Shared types for rug-radar. Filled in as each signal module lands.

export interface TokenLaunch {
  mint: string;
  deployer: string;
  createdAt: number;
}

export interface SignalResult {
  name: string;
  score: number; // 0 (safe) to 100 (high risk)
  reasons: string[];
}

export interface LaunchScore {
  mint: string;
  score: number;
  signals: SignalResult[];
}

// Tracks mints each deployer has created, built up live as the websocket
// watcher and the backstop poller discover launches (see server.ts) — not
// from retroactively scanning a deployer's signature history.
//
// Why this exists: fetchDeployerHistoryInput's retroactive scan (see
// data/deployerHistory.ts) only looks at a deployer's last N signatures, and
// a live-RPC check (README's "Known limitations") found that for a prolific
// deployer, create instructions are a tiny fraction of its own signature
// history — the scan mostly misses them, so the signal under-reports exactly
// the pattern it exists to catch. This index supplements that scan with
// mints we've directly observed this deployer create since the process
// started. It does not help with a deployer's pre-existing (pre-startup)
// history — only the retroactive scan can see further back.
//
// Bounded like LiveFeed/LaunchWatcher's own dedup structures: a single FIFO
// across all deployers, so a long-running process doesn't grow this forever.

export interface ObservedLaunch {
  mint: string;
  bondingCurve: string;
}

const DEFAULT_MAX_ENTRIES = 5000;

export class DeployerIndex {
  private readonly byDeployer = new Map<string, Map<string, string>>();
  private readonly order: Array<{ deployer: string; mint: string }> = [];

  constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

  record(launch: { deployer: string; mint: string; bondingCurve: string }): void {
    let mints = this.byDeployer.get(launch.deployer);
    if (!mints) {
      mints = new Map();
      this.byDeployer.set(launch.deployer, mints);
    }
    if (mints.has(launch.mint)) return;

    mints.set(launch.mint, launch.bondingCurve);
    this.order.push({ deployer: launch.deployer, mint: launch.mint });
    if (this.order.length > this.maxEntries) {
      const oldest = this.order.shift();
      if (oldest) {
        const oldestMints = this.byDeployer.get(oldest.deployer);
        oldestMints?.delete(oldest.mint);
        if (oldestMints && oldestMints.size === 0) this.byDeployer.delete(oldest.deployer);
      }
    }
  }

  // Mints observed for this deployer, excluding the one currently being
  // scored (the live discovery path records every launch, including the
  // current one, so callers don't have to record before looking it up).
  getPriorLaunches(deployer: string, excludeMint: string): ObservedLaunch[] {
    const mints = this.byDeployer.get(deployer);
    if (!mints) return [];
    const result: ObservedLaunch[] = [];
    for (const [mint, bondingCurve] of mints) {
      if (mint === excludeMint) continue;
      result.push({ mint, bondingCurve });
    }
    return result;
  }
}

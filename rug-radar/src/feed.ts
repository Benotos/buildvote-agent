// In-memory live feed of recently scored launches, newest first. Bounded size
// so a long-running process doesn't grow this list forever.

import type { LaunchScore } from "./types.js";

const DEFAULT_MAX_SIZE = 50;

export class LiveFeed {
  private launches: LaunchScore[] = [];
  private readonly mints = new Set<string>();

  constructor(private readonly maxSize: number = DEFAULT_MAX_SIZE) {}

  // Both the ws watcher and the poller backstop can discover the same mint;
  // callers should check this before fetching/scoring to avoid duplicate
  // work, not just duplicate feed entries.
  has(mint: string): boolean {
    return this.mints.has(mint);
  }

  add(score: LaunchScore): void {
    if (this.mints.has(score.mint)) return;
    this.mints.add(score.mint);
    this.launches.unshift(score);
    if (this.launches.length > this.maxSize) {
      const dropped = this.launches.pop();
      if (dropped) this.mints.delete(dropped.mint);
    }
  }

  list(): LaunchScore[] {
    return this.launches;
  }
}

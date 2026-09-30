// In-memory live feed of recently scored launches, newest first. Bounded size
// so a long-running process doesn't grow this list forever.

import type { LaunchScore } from "./types.js";

const DEFAULT_MAX_SIZE = 50;

export class LiveFeed {
  private launches: LaunchScore[] = [];

  constructor(private readonly maxSize: number = DEFAULT_MAX_SIZE) {}

  add(score: LaunchScore): void {
    this.launches.unshift(score);
    if (this.launches.length > this.maxSize) {
      this.launches.length = this.maxSize;
    }
  }

  list(): LaunchScore[] {
    return this.launches;
  }
}

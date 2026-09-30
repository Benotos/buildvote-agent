import test from "node:test";
import assert from "node:assert/strict";
import { LiveFeed } from "./feed.js";

function score(mint: string) {
  return { mint, score: 0, signals: [] };
}

test("list() returns newest-added first", () => {
  const feed = new LiveFeed();
  feed.add(score("A"));
  feed.add(score("B"));
  assert.deepEqual(feed.list().map((s) => s.mint), ["B", "A"]);
});

test("caps at maxSize, dropping the oldest entries", () => {
  const feed = new LiveFeed(2);
  feed.add(score("A"));
  feed.add(score("B"));
  feed.add(score("C"));
  assert.deepEqual(feed.list().map((s) => s.mint), ["C", "B"]);
});

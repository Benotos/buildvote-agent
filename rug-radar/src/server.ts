import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadConfig } from "./config.js";
import { SolanaRpcClient } from "./rpc.js";
import { LiveFeed } from "./feed.js";
import { pollOnce, type PollState } from "./poller.js";
import { scoreLaunch } from "./pipeline.js";
import { LaunchWatcher, deriveWsUrl } from "./wsDiscovery.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const config = loadConfig();
const feed = new LiveFeed();
const pollState: PollState = { sinceBlockTime: null };

// Two separate clients, each with half the previous shared budget
// (maxConcurrent: 2 apiece, same total of 4 in flight against the RPC as
// before), rather than one client used by both paths. The watcher's resolve
// call is latency-sensitive (it's the primary, near-real-time discovery
// path); the backstop poller's signature scans and scoring can run in
// bursts. Sharing one queue meant a busy poll cycle could delay the
// watcher's resolve behind a pile of poller requests. Splitting the budget
// doesn't change how many requests hit the public RPC at once — it just
// stops one path from starving the other's share of it.
const watcherRpc = new SolanaRpcClient(config.rpcUrl, fetch, { maxConcurrent: 2 });
const pollRpc = new SolanaRpcClient(config.rpcUrl, fetch, { maxConcurrent: 2 });

// Primary discovery is the websocket watcher (near-instant, sees every
// create as it happens). The poller below stays on as a backstop for
// launches created while the socket is down (startup, or a reconnect gap).
const wsUrl = config.wsUrl ?? deriveWsUrl(config.rpcUrl);
const watcher = new LaunchWatcher(wsUrl, watcherRpc, {
  onLaunch: (launch) => {
    if (feed.has(launch.mint)) return;
    scoreLaunch(watcherRpc, launch)
      .then((score) => feed.add(score))
      .catch((err) => {
        console.error(`failed to score launch ${launch.mint}:`, err instanceof Error ? err.message : err);
      });
  },
  onError: (err) => {
    console.error("launch watcher error:", err instanceof Error ? err.message : err);
  },
});

// How often the backstop poll checks the pump.fun program for new launches
// the watcher missed. Public RPCs rate limit aggressively, so this is a slow
// safety net, not the main discovery path.
const POLL_INTERVAL_MS = 15_000;

function poll(): void {
  pollOnce(pollRpc, feed, pollState).catch((err) => {
    console.error("poll failed:", err instanceof Error ? err.message : err);
  });
}

const server = createServer(async (req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    const html = await readFile(path.join(publicDir, "index.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html" });
    res.end(html);
    return;
  }

  if (req.url === "/api/feed") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ launches: feed.list() }));
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(config.port, () => {
  console.log(`rug-radar listening on http://localhost:${config.port}`);
  console.log(`using RPC: ${config.rpcUrl}`);
  console.log(`using WS: ${wsUrl}`);
  watcher.start();
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
});

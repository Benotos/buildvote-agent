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
const rpc = new SolanaRpcClient(config.rpcUrl);
const feed = new LiveFeed();
const pollState: PollState = { sinceBlockTime: null };

// Primary discovery is the websocket watcher (near-instant, sees every
// create as it happens). The poller below stays on as a backstop for
// launches created while the socket is down (startup, or a reconnect gap).
const wsUrl = config.wsUrl ?? deriveWsUrl(config.rpcUrl);
const watcher = new LaunchWatcher(wsUrl, rpc, {
  onLaunch: (launch) => {
    if (feed.has(launch.mint)) return;
    scoreLaunch(rpc, launch)
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
  pollOnce(rpc, feed, pollState).catch((err) => {
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

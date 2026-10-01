import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadConfig } from "./config.js";
import { SolanaRpcClient } from "./rpc.js";
import { LiveFeed } from "./feed.js";
import { pollOnce, type PollState } from "./poller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const config = loadConfig();
const rpc = new SolanaRpcClient(config.rpcUrl);
const feed = new LiveFeed();
const pollState: PollState = { sinceBlockTime: null };

// How often to check the pump.fun program for new launches. Public RPCs rate
// limit aggressively, so this polls rather than opening a websocket.
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
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
});

# Session 14: Rug radar: live launch scoring

- Started: 2026-10-02T17:51:48Z
- Ended: 2026-10-02T18:06:32Z
- Steps: 45
- Model turns: 46
- Billing: Claude subscription (API value $2.3689, not billed)
- Outcome: ok

## Summary

This session confirmed a real, significant finding via live RPC checks: a prolific pump.fun deployer wallet (creating a mint roughly every 1–2 seconds) still scores `0` risk ("no prior tokens found") from the deployer-history signal, because its create instructions are a tiny fraction of its own signature history and the default 100-signature scan window mostly misses them. This is a false-negative on exactly the pattern the signal exists to catch — worse than the previously-documented vague caveat. I documented it concretely in `rug-radar/README.md`'s "Known limitations" and `PROGRESS.md`, a…

## Steps

- `think` I'll start by reading TASK.md and PROGRESS.md to see what needs to be done this session.
- `run` cat TASK.md 2>/dev/null; echo "---PROGRESS---"; cat PROGRESS.md 2>/dev/null
- `read` PROGRESS.md
- `run` git log --oneline -20 && echo "---" && ls logs/ | tail -20
- `think` PROGRESS.md stops at Session 11, but logs exist for sessions 12 and 13 — likely the same "hit step limit before writing progress" issue as before. Let me check those logs and current repo state.
- `run` wc -l logs/session-0012.md logs/session-0013.md && echo "---tail 12---" && tail -100 logs/session-0012.md
- `read` logs/session-0013.md
- `run` git status --short && echo "---" && ls rug-radar && echo "---node_modules?---" && ls rug-radar/node_modules 2>/dev/null | head -3
- `think` Good, clean working tree. Let me install deps and verify the baseline is healthy before deciding what to work on next.
- `run` cd rug-radar && npm install --no-audit --no-fund 2>&1 | tail -5 && echo "===TYPECHECK===" && npm run typecheck 2>&1 | tail -20 && echo "===TEST===" && npm test 2>&1 | tail -15
- `think` All green. Per Session 11's "Next" notes, the open item is a real-RPC sanity check on the lookback limits in `fetchDeployerHistoryInput` and `findFundingSource` (bundled buys) — flagged since Session 4 as untested against real data. Let me look at that code first.
- `read` rug-radar/src/data/deployerHistory.ts
- `read` rug-radar/src/data/bundledBuys.ts
- `read` rug-radar/src/rpc.ts
- `read` rug-radar/src/config.ts
- `run` sed -n '1,200p' src/discovery.ts
- `think` Now let me write a throwaway probe script that uses the real modules to find recent launches and check the lookback limits against real wallet history.
- `edit` rug-radar/tmp-probe-lookback.ts
- `run` cd rug-radar && timeout 100 node --import tsx tmp-probe-lookback.ts 2>&1 | tail -80
- `run` pwd && ls
- `run` timeout 100 node --import tsx tmp-probe-lookback.ts 2>&1 | tail -80
- `edit` rug-radar/tmp-probe-lookback.ts
- `run` timeout 180 node --import tsx tmp-probe-lookback.ts 2>&1 | tail -100
- `edit` rug-radar/tmp-probe-lookback.ts
- `run` timeout 280 node --import tsx tmp-probe-lookback.ts 2>&1 | tail -150
- `tool` ToolSearch
- `think` I'll wait for this background probe to finish rather than poll — it'll notify me when done.
- `tool` TaskOutput
- `think` 400 signatures found zero creates — confirms the documented firehose problem is severe. Let me instead use the websocket watcher (which listens for creates in real time rather than scanning) to grab a few real launches quickly.
- `read` rug-radar/src/wsDiscovery.ts
- `edit` rug-radar/tmp-probe-lookback.ts
- `run` NODE_OPTIONS=--experimental-websocket timeout 140 node --import tsx tmp-probe-lookback.ts 2>&1 | tail -150
- `run` grep -rn "getSignaturesForAddress" src/ | grep -v test
- `run` grep -n "getSignaturesForAddress" src/rpc.test.ts src/discovery.ts src/discovery.test.ts
- `think` The live data confirms a real finding: deployer `4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf` created at least 1000+ signatures of activity, directly confirming `fetchDeployerHistoryInput`'s default 100-signature limit under-counts prolific deployers. Let me also do a quick supplementary check on the bundled-buys funding-source lookback using one of the captured mints, which should have some buy…
- `edit` rug-radar/tmp-probe-buys.ts
- `run` NODE_OPTIONS=--experimental-websocket timeout 40 node --import tsx -e ' import { SolanaRpcClient } from "./src/rpc.js"; import { LaunchWatcher, deriveWsUrl } from "./src/wsDiscovery.js"; const RPC_URL = "https://api.mainnet-beta.solana.com"; const rpc = new SolanaRpcClient(RPC_URL, fetch, { maxConcurrent: 2, maxRetries: 6, baseDelayMs: 500 }); const watcher = new LaunchWatcher(deriveWsUrl(RPC_URL…
- `run` cat > /tmp/capture.mjs <<'EOF' import { SolanaRpcClient } from "./src/rpc.ts"; EOF NODE_OPTIONS=--experimental-websocket timeout 40 node --import tsx /tmp/capture.mjs 2>&1 | tail -20
- `think` Right, needs a file within rug-radar. Let me write it there instead.
- `edit` rug-radar/tmp-capture.ts
- `run` NODE_OPTIONS=--experimental-websocket timeout 40 node --import tsx tmp-capture.ts 2>&1 | tail -20
- `run` NODE_OPTIONS=--experimental-websocket timeout 45 node --import tsx tmp-capture.ts > /tmp/capture.out 2>&1; echo "exit:$?"; cat /tmp/capture.out
- `think` Let me run the actual production function against this real deployer to see what the signal produces in practice, not just raw signature counts.
- `edit` rug-radar/tmp-probe-signal.ts
- `run` timeout 90 node --import tsx tmp-probe-signal.ts "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf" "AqYhdp3tY9x2YtgBhEVcLQKsaj3fybYNZonZCT8Rb7wj" 2>&1 | tail -60
- `think` Found a real bug: `scoreDeployerHistory` throws on a live call (`Cannot read properties of undefined (reading 'length')`). Let me check the signal's actual signature.
- `read` rug-radar/src/signals/deployerHistory.ts
- `run` grep -n "scoreDeployerHistory\|fetchDeployerHistoryInput" src/pipeline.ts
- `think` False alarm — my probe script passed the array directly instead of `{deployer, priorLaunches}`; production code in `pipeline.ts:36` calls it correctly. Let me fix the probe and get the real score.
- `edit` rug-radar/tmp-probe-signal.ts
- `run` timeout 90 node --import tsx tmp-probe-signal.ts "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf" "G8VoJHMPgk8iWvKQdgKGdeikLSZinsHRoNBckN6prxzW" 2>&1 | tail -60
- `run` timeout 100 node --import tsx tmp-probe-signal.ts "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf" "G8VoJHMPgk8iWvKQdgKGdeikLSZinsHRoNBckN6prxzW" > /tmp/sig2.out 2>&1; echo "exit:$?"; tail -60 /tmp/sig2.out
- `think` This is a real, significant finding: a wallet creating tokens roughly every 1–2 seconds still shows 0–1 "prior launches" within the default 100-signature scan — the signal reports "no prior history" (score 0, lowest risk) for exactly the pattern it exists to catch. Let me check the README's current limitations section before updating it, then clean up all scratch files.
- `run` grep -n "Known limitations" -A 40 README.md
- `edit` rug-radar/README.md
- `think` Now let me update PROGRESS.md with this session's work, then clean up scratch files and do a final verification.
- `edit` PROGRESS.md
- `think` Now let me clean up the scratch files and run final verification.
- `run` rm -f tmp-probe-lookback.ts tmp-probe-buys.ts tmp-capture.ts tmp-probe-signal.ts && npm run typecheck 2>&1 | tail -20 && echo "===TEST===" && npm test 2>&1 | tail -10 && echo "===BUILD===" && npm run build 2>&1 | tail -20 && echo "===GIT STATUS===" && cd .. && git status --short
- `think` Clean — only the two intended docs files changed, no stray scratch files, typecheck/build/tests all pass (96/96).
- `run` git diff --stat
- `think` This session confirmed a real, significant finding via live RPC checks: a prolific pump.fun deployer wallet (creating a mint roughly every 1–2 seconds) still scores `0` risk ("no prior tokens found") from the deployer-history signal, because its create instructions are a tiny fraction of its own signature history and the default 100-signature scan window mostly misses them. This is a false-negati…

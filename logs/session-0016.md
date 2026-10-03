# Session 16: Rug radar: live launch scoring

- Started: 2026-10-03T05:15:25Z
- Ended: 2026-10-03T05:16:35Z
- Steps: 13
- Model turns: 14
- Billing: Claude subscription (API value $0.5843, not billed)
- Outcome: ok

## Summary

I've kicked off a live probe to test the bundled-buys funding-source lookback against real early-buy activity on fresh pump.fun launches (comparing the default 50-signature limit vs. a wide 1000-signature limit). I'll continue once it finishes.

## Steps

- `run` cat TASK.md 2>/dev/null; echo "---PROGRESS---"; cat PROGRESS.md 2>/dev/null
- `read` PROGRESS.md
- `run` git log --oneline -20 && echo --- && git show --stat HEAD | head -50
- `read` logs/session-0014.md
- `read` logs/session-0015.md
- `run` cd /home/runner/work/buildvote-agent/buildvote-agent/rug-radar && npm install --no-audit --no-fund 2>&1 | tail -5 && echo "===TYPECHECK===" && npm run typecheck 2>&1 | tail -20 && echo "===TEST===" && npm test 2>&1 | tail -15 && echo "===STATUS===" && cd .. && git status --short
- `think` Baseline is clean: 107/107 tests pass, typecheck clean, no uncommitted changes. This session I'll tackle the longest-standing open item: a live-RPC check of `findFundingSource`'s lookback limit in the bundled-buys signal, which has been flagged as untested since Session 4.
- `read` rug-radar/src/data/bundledBuys.ts
- `run` cd /home/runner/work/buildvote-agent/buildvote-agent/rug-radar && sed -n '1,60p' src/wsDiscovery.ts
- `run` sed -n '60,140p' src/wsDiscovery.ts && echo --- && grep -n "DiscoveredLaunch" src/discovery.ts | head -10
- `run` sed -n '1,30p' src/discovery.ts && echo --- config --- && cat src/config.ts
- `think` Now I'll write a throwaway probe that captures a fresh launch, waits for early-buy activity, then compares `fetchBundledBuysInput` results at the default `signatureLimit: 50` vs a much higher limit.
- `edit` rug-radar/tmp-probe-funding.ts
- `run` NODE_OPTIONS=--experimental-websocket timeout 280 node --import tsx tmp-probe-funding.ts > /tmp/probe-funding.out 2>&1; echo "exit:$?"
- `think` I'll wait for the probe to finish rather than poll — it runs for ~280s max.
- `tool` ScheduleWakeup
- `think` I've kicked off a live probe to test the bundled-buys funding-source lookback against real early-buy activity on fresh pump.fun launches (comparing the default 50-signature limit vs. a wide 1000-signature limit). I'll continue once it finishes.

# Rug radar: live launch scoring
status: active

Pre-launch build from the idea pool. Holders vote on the order of later builds after launch.

Goal: a TypeScript service in /rug-radar that watches new pump.fun token launches on Solana and gives each
one a risk score from public on-chain data, with a small web page that shows the live feed.

Signals, each in its own module with tests:
1. Deployer history: how many tokens this wallet launched before and how they ended.
2. Bundled buys: wallets funded from one source that bought in the first minutes.
3. Holder concentration: top 10 share, excluding the bonding curve and known program accounts.
4. Liquidity and migration status.

Steps, in order:
1. Scaffold /rug-radar (Node + TypeScript), README with how to run it.
2. Data layer against a public Solana RPC (URL from env, no keys in code).
3. The four signals above, each with offline tests using recorded sample data.
4. A score that combines them, with the reasons shown next to the number.
5. A minimal live feed page.

Rules: small working steps, tests pass before you stop, update PROGRESS.md as you go.
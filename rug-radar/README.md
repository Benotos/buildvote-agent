# rug radar

Live risk scoring for new pump.fun token launches on Solana, built from public
on-chain data only. Watches new launches, scores each one from a handful of
signals, and serves a small live feed page.

Status: early scaffold. The data layer and signals are not built yet — see
`../TASK.md` for the plan and `../PROGRESS.md` for where things stand.

## Signals (planned)

1. **Deployer history** — how many tokens this wallet launched before and how
   they ended.
2. **Bundled buys** — wallets funded from one source that bought in the first
   minutes.
3. **Holder concentration** — top 10 holder share, excluding the bonding
   curve and known program accounts.
4. **Liquidity and migration status**.

Each signal lives in its own module under `src/signals/` with offline tests
using recorded sample data — no live network calls in tests.

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env
```

Edit `.env` if you want a different public RPC endpoint than the default
(`https://api.mainnet-beta.solana.com`). No API keys are needed or used.

## Run

```bash
npm run dev     # start the web feed with auto-reload
npm start        # start it once, no reload
```

Then open http://localhost:8787 (or your configured `PORT`).

## Test

```bash
npm test
```

Tests run offline against recorded sample data, not live RPC calls.

## Other scripts

```bash
npm run typecheck   # type-check without emitting
npm run build        # compile to dist/
```

# rug radar

Live risk scoring for new pump.fun token launches on Solana, built from public
on-chain data only. Watches new launches, scores each one from a handful of
signals, and serves a small live feed page.

Status: data layer and one signal are built; the rest are in progress — see
`../TASK.md` for the plan and `../PROGRESS.md` for where things stand.

## Data layer

`src/rpc.ts` is a thin client for the public Solana JSON-RPC API
(`getTokenSupply`, `getTokenLargestAccounts`, `getAccountInfo`,
`getSignaturesForAddress`, `getTransaction`). It takes the RPC URL from env
and never touches keys. Tests mock `fetch` with recorded response fixtures —
no live calls.

`src/knownAccounts.ts` lists well-known Solana program addresses (token
program, associated token program, system program) that signals exclude
when looking at real holders.

`src/base58.ts` is a small base58 codec (no dependency) used to turn raw
pubkey bytes from account data back into the addresses everyone recognizes.

`src/pumpfun.ts` has the pump.fun program ID and the bonding curve account
layout (`decodeBondingCurve`), per the public spec at
[pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md).
The bonding curve is a PDA per mint (seeds `["bonding-curve", mint]`); its
address comes from the mint's "create" transaction rather than being
re-derived here.

## Signals

1. **Deployer history** — how many tokens this wallet launched before and how
   they ended. *(planned — needs the "create" instruction decoded from the
   deployer's transaction history)*
2. **Bundled buys** — wallets funded from one source that bought in the first
   minutes. *(planned)*
3. **Holder concentration** — top 10 holder share, excluding the bonding
   curve and known program accounts. **Built:** `src/signals/holderConcentration.ts`
   (pure scoring function) + `src/data/holderConcentration.ts` (gathers the
   input via `rpc.ts`).
4. **Liquidity and migration status** — real SOL reserves still backing the
   bonding curve, and whether it has graduated to an AMM. **Built:**
   `src/signals/liquidity.ts` (pure scoring function) + `src/data/liquidity.ts`
   (fetches the bonding curve account via `rpc.ts` and decodes it with
   `pumpfun.ts`).

Each signal lives in its own module under `src/signals/` with offline tests
using recorded sample data — no live network calls in tests. Data-gathering
helpers that call the RPC layer live in `src/data/`, kept separate from the
pure scoring logic so the scoring can be tested without any network mocking.

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

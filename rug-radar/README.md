# rug radar

Live risk scoring for new pump.fun token launches on Solana, built from public
on-chain data only. Watches new launches, scores each one from a handful of
signals, and serves a small live feed page.

Status: all five steps of `../TASK.md` are built — data layer, all four
signals, the combined score, launch discovery, and the live feed page — and
have been sanity-checked against live mainnet-beta, not just offline
fixtures. See `../PROGRESS.md` for the full history and known limitations
(the biggest one: pump.fun's transaction volume is high enough that polling
signatures under-samples new launches — see "Known limitations" below).

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

`src/pumpfun.ts` has the pump.fun program ID, the bonding curve account
layout (`decodeBondingCurve`), and the `create`/`create_v2` instruction
layout (`decodeCreateInstruction`), per the program's public Anchor IDL at
[pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs)
(`idl/pump.json`). The bonding curve is a PDA per mint (seeds
`["bonding-curve", mint]`); rather than re-deriving it, both the liquidity
signal and deployer history read the address straight out of the relevant
transaction (the bonding curve account itself, or the `create` instruction's
account list).

## Signals

1. **Deployer history** — how many tokens this wallet launched before and how
   they ended. **Built:** `src/signals/deployerHistory.ts` (pure scoring
   function) + `src/data/deployerHistory.ts` (scans the deployer's
   transaction history for past pump.fun `create`/`create_v2` instructions,
   then checks each prior mint's bonding curve for whether it migrated).
2. **Bundled buys** — wallets funded from one source that bought in the first
   minutes. **Built:** `src/signals/bundledBuys.ts` (pure scoring function) +
   `src/data/bundledBuys.ts` (finds early buyers of the mint from the bonding
   curve's transaction history, then traces each buyer's earliest known
   transaction to find who funded them with SOL).
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

## Score

`src/scorer.ts` combines a launch's `SignalResult[]` into one `LaunchScore`:
a weighted average (0-100, higher is riskier) with every signal's reasons
attached so the number is never shown without its "why". Liquidity and
holder concentration — the most direct rug-pull indicators — carry double
the weight of wallet-behavior signals like bundled buys; any signal not
listed defaults to a weight of 1, so the combiner doesn't need updating
every time a new signal lands.

## Live feed

`src/discovery.ts` polls the pump.fun program ID's own signature history for
new `create`/`create_v2` instructions, tracking a timestamp watermark so each
poll only looks at launches newer than the last one. `src/pipeline.ts` turns
one discovered launch into a full `LaunchScore` by running all four signals'
data-fetch + score functions (a signal that fails to fetch — e.g. too early
for holder data to settle — is dropped rather than failing the whole
launch). `src/poller.ts` ties discovery → pipeline → `src/feed.ts` (a
bounded in-memory list, newest first) into one poll cycle; `src/server.ts`
runs it on a 15s interval and serves the result from `GET /api/feed`.
`public/index.html` polls that endpoint every 10s and renders each launch's
score and per-signal reasons.

`src/rpc.ts` retries `getTransaction`/other calls with backoff on HTTP 429
(the public RPC rate-limits aggressively) and requests
`maxSupportedTransactionVersion: 1` (mainnet-beta now rejects `0` for most
current transactions — both confirmed against live traffic, not guessed).

### Known limitations

- **Discovery under-samples.** Confirmed live: the pump.fun program sees
  roughly 500 tx/second across every instruction type combined (buy, sell,
  create, migrate) — 1000 signatures from `getSignaturesForAddress` span
  only ~2 seconds. A poll every 15s scanning the most recent ~50 signatures
  therefore catches a small slice of real launches, not all of them.
  Raising the per-poll limit doesn't fix this (the firehose dwarfs any sane
  limit) and makes rate-limiting worse, since each signature needs its own
  `getTransaction` call. A real fix needs a different discovery mechanism —
  most likely a websocket `logsSubscribe` with a `mentions` filter on the
  program, parsing `"Instruction: Create"` out of the log lines that arrive
  for free with the subscription instead of polling + fetching each
  transaction. Not attempted yet; see `src/discovery.ts`'s
  `FindNewLaunchesOptions.limit` comment.
- `fetchDeployerHistoryInput`'s and `findFundingSource`'s (in
  `src/data/bundledBuys.ts`) signature-count lookback limits mean both
  under-count a wallet with a very long history — acceptable for the common
  case (freshly created deployer/buyer wallets) but not exhaustive.

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

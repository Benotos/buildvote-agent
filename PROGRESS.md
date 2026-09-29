# Progress

## Session 1 — 2026-09-29

### Done
- Scaffolded `/rug-radar` as a Node 20 + TypeScript project (step 1 of TASK.md).
- `package.json` with scripts: `dev`, `start`, `build`, `test`, `typecheck`.
  Dev deps only: `typescript`, `tsx`, `@types/node`.
- `tsconfig.json` (strict, ES2022, NodeNext modules).
- `src/config.ts` loads `SOLANA_RPC_URL` and `PORT` from env with a public
  default RPC (`https://api.mainnet-beta.solana.com`), no keys anywhere.
- `src/config.test.ts` — offline unit test for config defaults/overrides.
- `src/types.ts` — shared `TokenLaunch` / `SignalResult` / `LaunchScore` types
  used by upcoming signal modules and the scorer.
- `src/server.ts` — minimal HTTP server serving `public/index.html` and a
  stub `GET /api/feed` returning `{ launches: [] }`.
- `public/index.html` — placeholder live feed page.
- `.env.example` — documents `SOLANA_RPC_URL` and `PORT`, no real values.
- `rug-radar/README.md` — install/run/test instructions and the signal plan.
- Added `dist/` to the root `.gitignore` (build output, not committed).

### Works
- `npm install`, `npm test` (2/2 passing, offline), `npm run typecheck`,
  `npm run build` all succeed in `/rug-radar`.
- `npm run dev` / `npm start` boot an HTTP server; manually verified
  `GET /` returns the HTML page and `GET /api/feed` returns `{"launches":[]}`.

### Next
- Step 2: build the data layer against the public Solana RPC (subscribe to
  new pump.fun mint/launch events, read account data) — URL from env only,
  no keys in code.
- Step 3: implement the four signals in `src/signals/`, each with its own
  module and offline tests using recorded sample data (no live calls in
  tests):
  1. Deployer history
  2. Bundled buys
  3. Holder concentration
  4. Liquidity and migration status
- Step 4: combine signals into a single score with reasons shown next to it.
- Step 5: wire the live feed page to the real data/score pipeline (currently
  a static stub).

## Session 2 — 2026-09-29

### Done
- Ran `npm install` in `/rug-radar` (node_modules wasn't present; needed for
  typecheck/test to run at all).
- Step 2: `src/rpc.ts` — thin client for the public Solana JSON-RPC API
  (`getTokenSupply`, `getTokenLargestAccounts`, `getAccountInfo`,
  `getSignaturesForAddress`, `getTransaction`). Takes the RPC URL from env
  via existing `config.ts`, no keys. `src/rpc.test.ts` mocks `fetch` with
  fixtures shaped like real RPC responses (10 tests: happy paths, null
  account, RPC-level error → `RpcError`, HTTP-level error).
- `src/knownAccounts.ts` — well-known, stable Solana program addresses
  (system/token/token-2022/associated-token programs) that signals should
  treat as non-holders. `src/knownAccounts.test.ts` sanity-checks the list.
- Step 3 (signal 3, Holder concentration), split into pure logic vs. data
  fetch so scoring is testable with zero network mocking:
  - `src/signals/holderConcentration.ts` — `scoreHolderConcentration()`:
    excludes given addresses (bonding curve + known program accounts),
    ranks the rest, sums the top 10, scores by share of total supply
    (>=50% → 90, 30-50% → 55, else a proportional score), reasons list the
    %. `src/signals/holderConcentration.test.ts` — 5 offline tests.
  - `src/data/holderConcentration.ts` — `fetchHolderConcentrationInput()`
    combines `getTokenSupply` + `getTokenLargestAccounts` into the signal's
    input. `src/data/holderConcentration.test.ts` — 1 test with a fake RPC
    object (no `fetch` mocking needed since it depends on `rpc.ts`'s typed
    interface, not the HTTP layer).
- Updated `rug-radar/README.md` to describe the data layer and the built
  signal; noted the other three signals as planned.

### Works
- `npm install`, `npm run typecheck`, `npm run build` all clean in
  `/rug-radar`.
- `npm test`: 18/18 passing, all offline (mocked `fetch` or fake RPC
  objects, no live network calls).

### Next
- Signal 1, Deployer history: needs the pump.fun program ID and how to spot
  a "token create" instruction + its outcome (migrated to Raydium /
  abandoned / still on the curve). Should confirm the exact program ID and
  instruction layout (e.g. via a web search for pump.fun's public program
  docs) before writing decoding logic, rather than guessing byte offsets.
- Signal 2, Bundled buys: build on `rpc.ts`'s `getSignaturesForAddress` +
  `getTransaction` (already implemented and tested) to find early buyers
  funded from a common source wallet.
- Signal 4, Liquidity and migration status: also needs pump.fun-specific
  knowledge (bonding curve reserves, migration completion flag) — same
  research step as signal 1 first.
- Step 4: a combiner that takes `SignalResult[]` → `LaunchScore` (weighted
  average or max-of-risk with reasons flattened) — can be built once at
  least 2 signals exist; holder-concentration alone isn't enough to be
  useful.
- Step 5: wire `GET /api/feed` (currently a stub in `src/server.ts`) to a
  real pipeline once signals + combiner exist.

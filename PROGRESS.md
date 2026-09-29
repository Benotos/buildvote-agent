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

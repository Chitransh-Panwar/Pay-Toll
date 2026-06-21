# PayToll (PT)

HTTP 402 paywall for AI agents, bots, and scrapers — built on Solana.

robots.txt is a request. PayToll is enforcement. When a bot or AI crawler hits a protected route, the server detects it locally and responds with `402 Payment Required` instead of content. The agent pays a few fractions of a cent in USDC on Solana, retries the request, and gets in. No API keys, no platform cut — payment goes straight from the agent's wallet to the publisher's wallet.

## Why

AI crawlers (GPTBot, ClaudeBot, PerplexityBot, and generic scrapers) read the web at scale and pay nothing for it. `robots.txt` is advisory and easy to ignore. PayToll moves the paywall to the protocol layer: detect the bot, price the request, verify the payment on-chain, then serve the content.

## How it works

```
Bot/Agent                  Publisher Server              Solana
   │                              │                          │
   │── GET /articles/x ──────────▶│                          │
   │                              │  bot detection runs       │
   │◀── 402 + challenge ──────────│                          │
   │                              │                          │
   │── USDC transfer ─────────────────────────────────────────▶│
   │                              │                          │
   │── GET /articles/x ──────────▶│                          │
   │   x-payment, x-paywall-challenge │── verify on-chain ───▶│
   │                              │◀── confirmed ─────────────│
   │◀── 200 + content ────────────│                          │
```

1. **Bot detection** scores the request locally — User-Agent patterns, missing browser headers, datacenter IP ranges (AWS/GCP/Cloudflare), reverse DNS. No network call needed for humans, so there's no latency penalty for real visitors.
2. **402 challenge** — a bot-scored request gets back a signed, single-use HMAC token plus the publisher's wallet address and price.
3. **Payment** — the agent sends a USDC SPL transfer on Solana to the publisher's wallet.
4. **Verification** — the server checks the transaction on-chain (correct recipient, correct amount, confirmed) and against a Supabase replay-protection table so one payment can't be reused.
5. **Content unlocks.**

## Project structure

```
PT/
├── packages/
│   ├── publisher-sdk/      → published as `paytoll-sdk` on npm
│   └── agent-sdk/          → published as `paytoll-agent-sdk` on npm
├── server/                 → reference facilitator server (uses publisher-sdk)
├── supabase/                → schema for replay protection + payment logs
└── .env                     → wallet, RPC, and HMAC secret config
```

Each package has its own README with full usage details:
- [`packages/publisher-sdk/README.md`](./packages/publisher-sdk/README.md) — for sites that want to charge bots
- [`packages/agent-sdk/README.md`](./packages/agent-sdk/README.md) — for agents/scrapers that need to pay paywalls automatically

## Quick start

**If you run a site and want to charge bots:**

```bash
npm install paytoll-sdk
```

```js
import { createPaywall } from "paytoll-sdk";
import { expressMiddleware } from "paytoll-sdk/express";

const paywall = createPaywall({
  walletAddress: "your_solana_wallet_address",
  protect: ["/articles/*"],
  basePriceMicroUsdc: 1000, // $0.001 per request
});

app.use(expressMiddleware(paywall));
```

**If you build an agent/scraper and want it to pay automatically:**

```bash
npm install paytoll-agent-sdk
```

```js
import { createAgentPaywallClient, fromKeypairFile } from "paytoll-agent-sdk";

const client = createAgentPaywallClient({
  network: "devnet",
  signer: fromKeypairFile(),
  maxAmountMicroUsdc: 10_000,
  maxTotalMicroUsdc: 1_000_000,
});

const res = await client.fetch("https://example.com/articles/ai-trends");
```

See the package READMEs linked above for Fastify, Next.js, and Cloudflare Workers adapters.

## Running the reference server locally

```bash
git clone <this repo>
cd PT
npm install
```

Set up `.env`:
```
SOLANA_WALLET_ADDRESS=your_devnet_wallet
SOLANA_RPC_URL=https://api.devnet.solana.com
PAYWALL_CHALLENGE_SECRET=<openssl rand -hex 32>
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Run the schema in `supabase/schema.sql` against your Supabase project, then:

```bash
npm start
```

Test it:
```bash
curl -A "GPTBot/1.0" http://localhost:3000/articles/test
# → 402 with payment challenge

curl http://localhost:3000/articles/test
# → 200, human pass-through
```

## Bot detection signals

| Signal | What it catches |
|---|---|
| User-Agent patterns | Known AI crawlers (GPTBot, ClaudeBot, PerplexityBot...), headless browsers (Playwright, Puppeteer), basic scrapers (curl, requests, axios) |
| Missing browser headers | Real browsers send `Accept-Language`, `sec-fetch-site`, `sec-ch-ua`; scripts usually don't |
| `sec-fetch-mode` | Browser navigation sends `navigate`; programmatic `fetch()` sends `cors` |
| Datacenter IP ranges | AWS, GCP, Cloudflare CIDR blocks, refreshed every 24h |
| Reverse DNS | Verifies claimed search engine bots actually resolve to that provider's infra |

Each signal contributes a score; a request crossing the threshold gets a 402.

## Security notes

- Challenge tokens are HMAC-signed and single-use (10-minute expiry)
- Payments are verified on-chain — recipient, amount, and confirmation status are all checked, not just "a transaction exists"
- Replay protection is backed by Supabase (`verified_tx_cache`) so a paid signature can't unlock content twice
- This is a learning/portfolio project — review and harden before any production/mainnet use

## Tech stack

Node.js, Express (+ Fastify/Next.js/Cloudflare adapters), Solana (`@solana/web3.js`, `@solana/spl-token`), USDC (SPL token), Supabase (Postgres).

## License

MIT
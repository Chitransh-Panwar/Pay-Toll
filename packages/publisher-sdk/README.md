# paytoll-sdk

Drop-in HTTP 402 paywall for AI bots and scrapers. Detect crawlers locally, charge them in USDC on Solana, and let humans through untouched — no API keys, no platform cut, payments land directly in your wallet.

## Install

```bash
npm install paytoll-sdk
```

## Quick start

Every adapter shares the same `createPaywall()` config. Pick the one matching your framework.

### Express

```js
import express from "express";
import { createPaywall } from "paytoll-sdk";
import { expressMiddleware } from "paytoll-sdk/express";

const app = express();

const paywall = createPaywall({
  walletAddress: "your_solana_wallet_address",
  protect: ["/articles/*"],
  basePriceMicroUsdc: 1000, // $0.001 per request
  network: "devnet",        // or "mainnet-beta"
});

app.use(expressMiddleware(paywall));

app.get("/articles/:slug", (req, res) => {
  res.json({ content: "...", paid: !!req.paywallPayment });
});

app.listen(3000);
```

### Fastify

```js
import Fastify from "fastify";
import { createPaywall } from "paytoll-sdk";
import { fastifyPlugin } from "paytoll-sdk/fastify";

const fastify = Fastify();

const paywall = createPaywall({
  walletAddress: "your_solana_wallet_address",
  protect: ["/articles/*"],
  basePriceMicroUsdc: 1000,
  network: "devnet",
});

fastify.register(fastifyPlugin, { paywall });

fastify.get("/articles/:slug", async (req, reply) => {
  return { content: "...", paid: !!req.paywallPayment };
});

fastify.listen({ port: 3000 });
```

### Next.js (App Router)

```js
// app/api/articles/[slug]/route.js
import { createPaywall } from "paytoll-sdk";
import { withPaywallNextjs } from "paytoll-sdk/nextjs";

const paywall = createPaywall({
  walletAddress: "your_solana_wallet_address",
  protect: ["/api/articles/*"],
  basePriceMicroUsdc: 1000,
  network: "devnet",
});

export const GET = withPaywallNextjs(paywall, async (request, context, payment) => {
  return Response.json({ content: "...", paid: !!payment });
});
```

### Cloudflare Workers

```js
import { createPaywall } from "paytoll-sdk";
import { withPaywall } from "paytoll-sdk/cloudflare";

const paywall = createPaywall({
  walletAddress: "your_solana_wallet_address",
  protect: ["/articles/*"],
  basePriceMicroUsdc: 1000,
  network: "devnet",
});

async function handleArticle(request, env, ctx, payment) {
  return new Response(JSON.stringify({ content: "...", paid: !!payment }), {
    headers: { "content-type": "application/json" },
  });
}

export default {
  fetch: withPaywall(paywall, handleArticle),
};
```

In every case: human visitors pass through unaffected. Detected bots/AI crawlers get an HTTP 402 with a payment challenge; once they pay the required USDC on Solana and retry with proof, content unlocks.

## How it works

1. Request comes in on a protected route
2. Local bot detection scores the request (User-Agent, headers, datacenter IP ranges, reverse DNS)
3. If it's a bot, the server returns `402` with a signed challenge and your wallet address
4. The agent pays USDC on Solana and retries with `x-payment` + `x-paywall-challenge` headers
5. Payment is verified on-chain and against a replay-protection cache before content unlocks

## Adapters

- `paytoll-sdk/express`
- `paytoll-sdk/fastify`
- `paytoll-sdk/cloudflare`
- `paytoll-sdk/nextjs`

## Requirements

- A Supabase project (for replay protection / payment logs) — set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- A Solana wallet to receive payments
- `PAYWALL_CHALLENGE_SECRET` env var (HMAC secret for signed challenges)

## License

MIT
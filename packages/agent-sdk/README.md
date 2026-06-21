# paytoll-agent-sdk

Drop-in fetch wrapper for AI agents and scrapers. Automatically detects HTTP 402 paywalls, pays them in USDC on Solana, and retries the request — no manual payment handling required.

## Install

```bash
npm install paytoll-agent-sdk @solana/web3.js @solana/spl-token
```

## Quick start

```js
import { createAgentPaywallClient, fromKeypairFile } from "paytoll-agent-sdk";

const client = createAgentPaywallClient({
  network: "devnet",                // or "mainnet-beta"
  signer: fromKeypairFile(),        // reads ~/.config/solana/id.json by default
  maxAmountMicroUsdc: 10_000,       // hard cap: never pay more than $0.01 per request
  maxTotalMicroUsdc: 1_000_000,     // session budget: $1.00 total
});

// Use exactly like fetch — payment is handled automatically
const res = await client.fetch("https://example.com/articles/ai-trends");
const data = await res.json();

console.log("Paid:", res.paywallPayment?.signature);
console.log("Total spend this session:", client.spend(), "microUSDC");
```

If the target server has no paywall, `client.fetch` behaves exactly like normal `fetch` — no payment, no extra latency.

## How it works

1. `client.fetch(url)` makes the request
2. If the response is `402`, it reads the payment envelope (`payTo`, `amount`, `challenge`)
3. Budget guards check the request against `maxAmountMicroUsdc` and `maxTotalMicroUsdc`
4. A USDC transfer is signed and sent on Solana
5. The original request is retried with `x-payment` and `x-paywall-challenge` headers
6. The final response is returned, with `res.paywallPayment` attached for visibility

Concurrent requests to the same URL + challenge are deduplicated — only one payment is sent, other callers await the same in-flight payment.

## Signer options

```js
import {
  fromKeypair,         // pass a @solana/web3.js Keypair directly
  fromKeypairFile,      // read Solana CLI keypair JSON (default: ~/.config/solana/id.json)
  fromSecretKeyArray,   // number[] or Uint8Array
  fromSecretKeyBase58,  // base58-encoded secret key string
} from "paytoll-agent-sdk";
```

## Errors

All thrown errors extend `PaywallError` and carry a `.code`:

| Error | code |
|---|---|
| `PaymentAmountExceededError` | `AMOUNT_EXCEEDED` |
| `PaymentBudgetExceededError` | `BUDGET_EXCEEDED` |
| `PaywallVerificationError` | `VERIFICATION_FAILED` |
| `PaywallParseError` | `PARSE_ERROR` |

```js
import { PaymentBudgetExceededError } from "paytoll-agent-sdk";

try {
  await client.fetch(url);
} catch (err) {
  if (err instanceof PaymentBudgetExceededError) {
    console.log("Session budget exhausted, stopping crawl.");
  }
}
```

## License

MIT
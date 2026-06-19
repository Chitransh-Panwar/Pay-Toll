
/**
 * @typedef {object} PaywallConfig
 * @property {string} walletAddress           Solana wallet address that receives USDC payments.
 * @property {"devnet"|"mainnet-beta"|string} [network="devnet"] Solana network.
 * @property {string} [usdcMint]              Override USDC mint (defaults to canonical mint per network).
 * @property {string} [apiUrl]                Override facilitator URL (defaults to hosted service).
 * @property {Array<string|RegExp>} [protect] Path matchers; only matched paths are gated.
 * @property {number} [basePriceMicroUsdc=1000] Per-call price (1_000 = $0.001).
 * @property {number} [botScoreThreshold=70]  Threshold for bot classification.
 * @property {Array<{pattern: RegExp, name?: string}>} [allowList] Always-allow UA patterns.
 * @property {boolean} [failOpen=false]       If true, allow request through when facilitator is down.
 * @property {Function} [onDetection]         Hook called with the detection object.
 * @property {Function} [fetchImpl]           Custom fetch (e.g. for Cloudflare Workers).
 * @property {number} [timeoutMs=8000]        Network timeout for facilitator calls.
 */

function isLikelySolanaAddress(value) {
  if (typeof value !== "string") return false;
  if (value.length < 32 || value.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}


export function createPaywall(config={}) {
    const {
        walletAddress,
        protect,
        basePriceMicroUsdc=1000,
        network="devnet"
    } = config
    

    if(!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim() === '') {
        throw new Error("Paywall configuration error:'walletaddres' is a required parameter ");
    }

    if (!isLikelySolanaAddress(config.walletAddress)) {
        throw new Error(
            `createPaywall: walletAddress "${config.walletAddress}" does not look like a valid Solana address (base58, 32-44 chars).`,
        );
    }
    if (!protect || !Array.isArray(protect) || protect.length === 0) {
        throw new Error("Paywall configuration error : 'protect' is a required array containing at least one route pattern ")
    }

    return {
        walletAddress,
        protect,
        basePriceMicroUsdc,
        network,
    };
}